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
import { compter } from '@empreinte-studio/angular/core';
import { EArete, type EtapeArete } from '@empreinte-studio/angular/arete';
import { EBouton } from '@empreinte-studio/angular/bouton';
import { Feuilles } from '@empreinte-studio/angular/feuille';
import { EIcone } from '@empreinte-studio/angular/icone';
import { TITRES_QUADRANTS } from '@empreinte-studio/angular/matrice';
import { EFilAriane } from '@empreinte-studio/angular/navigation';
import { ENote, ENoteActions } from '@empreinte-studio/angular/note';
import { EPas } from '@empreinte-studio/angular/pas';
import { EListe, ETache, ETacheActions } from '@empreinte-studio/angular/tache';
import { AnnoncesStore } from '../../chore/stores/annonces.store';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { stageIdFromArete } from '../../chore/mapper/objective-view.mapper';
import { CRUMB_TITLE_MAX, shortTitle } from '../../chore/mapper/title.mapper';
import { isTemporaryId } from '../../chore/stores/utils/map-optimistique-id';
import { WriteQueue } from '../../chore/stores/utils/write-queue';
import type { StageTaskViewModel, StageViewModel } from '../../chore/models/objective-detail.viewmodel';
import { AddStageSheet, type AddStageSheetData } from './sheets/add-stage-sheet';
import { AddTaskSheet, type AddTaskSheetData } from './sheets/add-task-sheet';
import { EditObjectiveSheet, type EditObjectiveSheetData } from './sheets/edit-objective-sheet';
import { EditStageSheet, type EditStageSheetData } from './sheets/edit-stage-sheet';
import { EditTaskSheet, type EditTaskSheetData } from './sheets/edit-task-sheet';
import { stageName, stageStateLabel } from './stage-labels';

/** Ce que l'étape ouverte suit : l'objectif et ses étapes. */
type OpenStageSource = {
  objectiveId: string;
  stageIds: readonly string[];
};

/**
 * L'écran d'un objectif : l'arête (route /objectifs/:id, maquette « Arete »).
 * À gauche l'arête de ses étapes, dont la tête est le sceau de l'écran ; à droite l'étape que la personne
 * choisit, et ses pas : aucun ordre entre les étapes, l'écran n'en ouvre aucune de lui-même. Les modifications passent par des feuilles, ouvertes avec l'injecteur de l'écran pour
 * atteindre ObjectiveStore (fourni par la coque) ; toutes les actions du store sont optimistes.
 */
@Component({
  selector: 'app-objective-page',
  imports: [
    RouterLink,
    EArete,
    EBouton,
    EFilAriane,
    EIcone,
    EListe,
    ENote,
    ENoteActions,
    EPas,
    ETache,
    ETacheActions,
  ],
  templateUrl: './objective-page.html',
  styleUrl: './objective-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjectivePage {
  /** L'id de l'objectif, lu dans la route. */
  readonly id = input.required<string>();

  protected readonly store = inject(ObjectiveStore);
  private readonly annonces = inject(AnnoncesStore);
  private readonly writes = inject(WriteQueue);
  private readonly feuilles = inject(Feuilles);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  protected readonly stageStateLabel = stageStateLabel;
  /** La coque affiche un signalement (une note d'Akari) : l'écran n'en pose pas une seconde. */
  protected readonly hasReport = this.annonces.aUnSignalement;
  protected readonly quadrantTitles = TITRES_QUADRANTS;
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

  /** « 6 étapes », pour le titre de l'arête. */
  protected readonly stageCount = computed(() => compter(this.detail()?.stages.length ?? 0, 'étape'));

  /**
   * L'id de l'étape ouverte à droite de l'arête, celle que la personne a choisie ; null tant qu'elle n'en a
   * choisi aucune. Elle reste ouverte tant qu'elle existe, même une fois faite, et quand son id temporaire est
   * remplacé à l'enregistrement. Sur un autre objectif, plus rien n'est ouvert.
   */
  private readonly openStageId = linkedSignal<OpenStageSource, string | null>({
    source: () => {
      const detail = this.detail();
      return { objectiveId: this.id(), stageIds: detail?.stages.map((stage) => stage.id) ?? [] };
    },
    computation: (source, previous) => {
      if (!previous?.value || previous.source.objectiveId !== source.objectiveId) return null;
      const kept = this.writes.resolve(previous.value);
      return source.stageIds.includes(kept) ? kept : null;
    },
  });

  /** L'étape ouverte à droite de l'arête. */
  protected readonly stage = computed(() => {
    const id = this.openStageId();
    return this.detail()?.stages.find((stage) => stage.id === id);
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

  /** Une arête a été choisie : son étape s'ouvre à droite, et les lecteurs d'écran l'entendent. */
  protected chooseStage(etape: EtapeArete): void {
    const stages = this.detail()?.stages ?? [];
    const id = stageIdFromArete(etape) ?? this.foldedDoneStageId(stages);
    const stage = stages.find((item) => item.id === id);
    if (!stage) return;
    this.openStageId.set(stage.id);
    this.annonces.annoncer(`${stageName(stage.title)} · ${stageStateLabel(stage.done)}`);
  }

  /**
   * Au-delà de 8 étapes, Empreinte replie les étapes faites dans une arête « Faites » sans id. Chaque choix
   * de cette arête ouvre une autre étape faite, à tour de rôle : toutes restent atteignables.
   */
  private foldedDoneStageId(stages: readonly StageViewModel[]): string | null {
    const done = stages.filter((stage) => stage.done);
    if (done.length === 0) return null;
    const open = done.findIndex((stage) => stage.id === this.openStageId());
    return done[open > 0 ? open - 1 : done.length - 1].id;
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
   * Le bouton qui a ouvert la feuille peut avoir disparu (une étape ajoutée depuis la note d'Akari, un pas
   * rangé dans une autre étape) : le focus tomberait alors sur la page entière. Il va sur le titre de l'étape
   * ouverte, sinon sur celui de l'objectif.
   */
  private recoverFocus(): void {
    const active = this.document.activeElement;
    if (active && active !== this.document.body && active.isConnected) return;
    (this.stageHeading() ?? this.pageHeading())?.nativeElement.focus();
  }
}
