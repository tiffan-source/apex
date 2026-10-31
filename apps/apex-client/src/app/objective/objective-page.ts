import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import type { ComponentType } from '@angular/cdk/portal';
import { NgTemplateOutlet } from '@angular/common';
import {
  AxIcon,
  AxPath,
  AxRings,
  AxSteps,
  Feuilles,
  TITRES_QUADRANTS,
  compter,
  legendeProgression,
  lumiereDe,
  type Anneau,
  type EtapeArete,
} from '../../ui';
import { AnnoncesStore } from '../../chore/stores/annonces.store';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { stageIdFromArete } from '../../chore/mapper/objective-view.mapper';
import { CRUMB_TITLE_MAX, shortTitle } from '../../chore/mapper/title.mapper';
import { isTemporaryId } from '../../chore/stores/utils/map-optimistique-id';
import type { StageTaskViewModel, StageViewModel } from '../../chore/models/objective-detail.viewmodel';
import { AddStageSheet, type AddStageSheetData } from './sheets/add-stage-sheet';
import { AddTaskSheet, type AddTaskSheetData } from './sheets/add-task-sheet';
import { EditObjectiveSheet, type EditObjectiveSheetData } from './sheets/edit-objective-sheet';
import { EditStageSheet, type EditStageSheetData } from './sheets/edit-stage-sheet';
import { EditTaskSheet, type EditTaskSheetData } from './sheets/edit-task-sheet';
import { STAGE_STATE_LABELS, stageName } from './stage-labels';

/** Ce que l'étape ouverte suit : l'objectif, ses étapes et celle en cours. */
type OpenStageSource = {
  objectiveId: string;
  stageIds: readonly string[];
  defaultStageId: string | null;
};

/**
 * L'écran d'un objectif (route /objectifs/:id, maquette « Arete ») : son en-tête et l'anneau de ses pas,
 * le chemin de ses étapes jusqu'au sommet, puis l'étape choisie et ses pas, à côté d'Akari et d'un
 * résumé. Les modifications passent par des feuilles, ouvertes avec l'injecteur de l'écran pour
 * atteindre ObjectiveStore (fourni par la coque) ; toutes les actions du store sont optimistes.
 */
@Component({
  selector: 'app-objective-page',
  imports: [RouterLink, NgTemplateOutlet, AxIcon, AxPath, AxRings, AxSteps],
  templateUrl: './objective-page.html',
  styleUrl: './objective-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjectivePage {
  /** L'id de l'objectif, lu dans la route. */
  readonly id = input.required<string>();

  protected readonly store = inject(ObjectiveStore);
  private readonly annonces = inject(AnnoncesStore);
  private readonly feuilles = inject(Feuilles);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  protected readonly stageStateLabels = STAGE_STATE_LABELS;
  /** La coque affiche un signalement (une note d'Akari) : l'écran n'en pose pas une seconde. */
  protected readonly hasReport = this.annonces.aUnSignalement;
  protected readonly stageName = stageName;

  /** Les titres où poser le focus quand le bouton qui a ouvert une feuille a disparu. */
  private readonly pageHeading = viewChild<ElementRef<HTMLElement>>('pageHeading');
  private readonly stageHeading = viewChild<ElementRef<HTMLElement>>('stageHeading');

  /**
   * L'objectif affiché. Seulement un objectif racine : objectiveDetail accepte aussi l'id d'une
   * étape, qu'il traiterait comme un objectif.
   */
  protected readonly detail = computed(() => {
    const id = this.id();
    const isRootObjective = this.store.objectiveOptions().some((option) => option.valeur === id);
    return isRootObjective ? this.store.objectiveDetail(id) : undefined;
  });

  /**
   * Introuvable une fois les objectifs chargés (objectivesLoaded) ; jamais pendant le chargement, ni après
   * un chargement qui n'a pas abouti : la coque affiche alors le signalement.
   */
  protected readonly notFound = computed(() => this.store.objectivesLoaded() && !this.detail());

  /** Le titre de l'objectif dans le fil d'Ariane. */
  protected readonly crumb = computed(() => shortTitle(this.detail()?.objective.title ?? '', CRUMB_TITLE_MAX));

  /** « 3 étapes », sous le titre du chemin. */
  protected readonly stageCount = computed(() => compter(this.detail()?.stages.length ?? 0, 'étape'));

  /** La couleur de l'objectif, la même que dans la navigation. */
  protected readonly lumiere = computed(() => lumiereDe(this.id()));

  /** L'anneau des pas faits sur le total ; aucun anneau sans pas. */
  protected readonly ring = computed(() => {
    const count = this.detail()?.taskCount;
    if (!count || count.total === 0) return null;
    const faits = count.done > 1 ? 'faits' : 'fait';
    return {
      rings: [{ done: count.done, total: count.total }] satisfies Anneau[],
      done: count.done,
      total: count.total,
      caption: `pas ${faits}`,
      label: `${compter(count.done, 'pas', 'pas')} ${faits} sur ${count.total}`,
    };
  });

  /** « En bref » : l'horizon, les étapes et les pas, en légendes qui commencent par ce qui est fait. */
  protected readonly facts = computed(() => {
    const detail = this.detail();
    if (!detail) return [];
    const states = detail.stages.map((stage) => stage.state);
    const count = detail.taskCount;
    return [
      { term: 'Horizon', value: detail.objective.horizon },
      {
        term: 'Étapes',
        value: legendeProgression(
          {
            faits: states.filter((state) => state === 'faite').length,
            enCours: states.includes('en-cours'),
            aVenir: states.filter((state) => state === 'a-venir').length,
          },
          { unite: 'etape', accompli: 'chemin parcouru' },
        ),
      },
      {
        term: 'Pas',
        value: legendeProgression({ faits: count.done, aVenir: count.total - count.done }, { accompli: 'tout est fait' }),
      },
    ].filter((fact) => fact.value);
  });

  /**
   * L'id de l'étape ouverte sous le chemin : d'abord celle en cours. Elle reste ouverte tant qu'elle
   * existe, même quand elle s'achève et qu'une autre passe en cours : cocher son dernier pas ne fait ni
   * sauter le panneau vers l'étape suivante, ni perdre le focus de la case. Elle revient à l'étape en
   * cours sur un autre objectif, et quand son id temporaire est remplacé à l'enregistrement.
   */
  private readonly openStageId = linkedSignal<OpenStageSource, string | null>({
    source: () => {
      const detail = this.detail();
      return {
        objectiveId: this.id(),
        stageIds: detail?.stages.map((stage) => stage.id) ?? [],
        defaultStageId: detail?.defaultStageId ?? null,
      };
    },
    computation: (source, previous) => {
      const kept = previous?.source.objectiveId === source.objectiveId ? previous.value : null;
      return kept !== null && source.stageIds.includes(kept) ? kept : source.defaultStageId;
    },
  });

  /** L'étape ouverte sous le chemin. */
  protected readonly stage = computed(() => {
    const id = this.openStageId();
    return this.detail()?.stages.find((stage) => stage.id === id);
  });

  /** La même étape sur le chemin : ax-path la reconnaît à son objet. */
  protected readonly selectedArete = computed(() => {
    const id = this.openStageId();
    return this.detail()?.aretes.find((arete) => arete.id === id) ?? null;
  });

  /** La demande à Akari prépare l'étape ouverte ; jamais un id temporaire dans une URL. */
  protected readonly akariQuery = computed(() => {
    const stage = this.stage();
    return stage && !isTemporaryId(stage.id) ? { etape: stage.id } : null;
  });

  /** L'invitation à ranger les pas sans étape. */
  protected readonly looseTasksHint = computed(() =>
    (this.detail()?.stages.length ?? 0) > 0
      ? 'Ces pas ne sont dans aucune étape. Range-les avec « Modifier ».'
      : 'Ces pas ne sont dans aucune étape. Ajoute une étape, puis range-les avec « Modifier ».',
  );

  /** Une étape a été choisie sur le chemin : elle s'ouvre dessous, et les lecteurs d'écran l'entendent. */
  protected chooseStage(etape: EtapeArete): void {
    const id = stageIdFromArete(etape);
    const stage = this.detail()?.stages.find((item) => item.id === id);
    if (!stage) return;
    this.openStageId.set(stage.id);
    this.annonces.annoncer(`Étape ${stage.index} · ${STAGE_STATE_LABELS[stage.state]} : ${stageName(stage.title)}`);
  }

  /** Le quadrant d'un pas à faire : « Maintenant », « À planifier »… */
  protected quadrantTitle(task: StageTaskViewModel): string {
    return TITRES_QUADRANTS[task.quadrant];
  }

  /** Cocher ou décocher un pas : le store le change tout de suite, et revient en arrière s'il n'est pas enregistré. */
  protected toggleTask(taskId: string, done: boolean): void {
    this.store.updateTaskDone({ taskId, done });
  }

  protected editObjective(): void {
    const objective = this.detail()?.objective;
    if (!objective) return;
    this.open<EditObjectiveSheet, EditObjectiveSheetData>(EditObjectiveSheet, {
      objective: {
        id: objective.id,
        title: objective.title,
        description: objective.description,
        why: objective.why,
        dueDate: objective.dueDate,
      },
    });
  }

  protected addStage(): void {
    this.open<AddStageSheet, AddStageSheetData>(AddStageSheet, { objectiveId: this.id() });
  }

  protected editStage(stage: StageViewModel): void {
    this.open<EditStageSheet, EditStageSheetData>(EditStageSheet, {
      stage: { id: stage.id, title: stage.title, description: stage.description, dueDate: stage.dueDate },
    });
  }

  protected addTask(stageId: string): void {
    this.open<AddTaskSheet, AddTaskSheetData>(AddTaskSheet, { objectiveId: this.id(), stageId });
  }

  /** Modifier un pas ; stageId vaut null pour un pas sans étape, que la feuille invite à ranger. */
  protected editTask(task: StageTaskViewModel, stageId: string | null): void {
    this.open<EditTaskSheet, EditTaskSheetData>(EditTaskSheet, { objectiveId: this.id(), stageId, task });
  }

  /**
   * Ouvre une feuille avec l'injecteur de l'écran : sans lui, ObjectiveStore (fourni par la coque) est
   * introuvable. À la fermeture, le CDK rend le focus au bouton qui l'a ouverte.
   */
  private open<C, D>(component: ComponentType<C>, donnees: D): void {
    this.feuilles
      .ouvrir<C, D>(component, { donnees, cdk: { injector: this.injector } })
      .closed.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => afterNextRender(() => this.recoverFocus(), { injector: this.injector }));
  }

  /**
   * Le bouton qui a ouvert la feuille peut avoir disparu (la première étape ajoutée depuis la note d'Akari,
   * un pas rangé dans une autre étape) : le focus tomberait alors sur la page entière. Il va sur le titre
   * de l'étape ouverte, sinon sur celui de l'objectif.
   */
  private recoverFocus(): void {
    const active = this.document.activeElement;
    if (active && active !== this.document.body && active.isConnected) return;
    (this.stageHeading() ?? this.pageHeading())?.nativeElement.focus();
  }
}
