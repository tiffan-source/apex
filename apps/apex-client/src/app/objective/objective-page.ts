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
import { isTemporaryId } from '../../chore/stores/utils/map-optimistique-id';
import type { RequestStatus } from '../../chore/stores/utils/loading-feature';
import type { AreteStageViewModel, StageTaskViewModel, StageViewModel } from '../../chore/models/objective-detail.viewmodel';
import { AddStageSheet, type AddStageSheetData } from './sheets/add-stage-sheet';
import { AddTaskSheet, type AddTaskSheetData } from './sheets/add-task-sheet';
import { EditObjectiveSheet, type EditObjectiveSheetData } from './sheets/edit-objective-sheet';
import { EditStageSheet, type EditStageSheetData } from './sheets/edit-stage-sheet';
import { EditTaskSheet, type EditTaskSheetData } from './sheets/edit-task-sheet';
import { STAGE_STATE_LABELS, UNTITLED_STAGE, stageName } from './stage-labels';

/** Au-delà, le titre de l'objectif est coupé dans le fil d'Ariane. */
export const SHORT_TITLE_MAX = 32;

/** Le titre court d'un objectif pour le fil d'Ariane : coupé entre deux mots, suivi de « … ». */
export function shortTitle(title: string, max = SHORT_TITLE_MAX): string {
  const clean = title.trim().replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  const head = clean.slice(0, max + 1);
  const lastSpace = head.lastIndexOf(' ');
  const cut = lastSpace > max / 2 ? head.slice(0, lastSpace) : clean.slice(0, max);
  return `${cut.trimEnd()}…`;
}

/** Ce que l'étape ouverte suit : l'objectif, ses étapes et celle en cours. */
type OpenStageSource = {
  objectiveId: string;
  stageIds: readonly string[];
  defaultStageId: string | null;
};

/**
 * L'écran d'un objectif : l'arête (route /objectifs/:id, maquette « Arete »).
 * À gauche l'arête de ses étapes, dont la tête est le sceau de l'écran ; à droite l'étape choisie
 * et ses pas. Les modifications passent par des feuilles, ouvertes avec l'injecteur de l'écran pour
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
   * Vrai dès que le store a fini un chargement (ou une écriture) avec succès, et pour de bon.
   * requestStatus est partagé par toutes les écritures, d'où la mémoire : une écriture qui le repasse
   * à 'pending' ne fait pas oublier que les objectifs sont là. Un chargement qui n'aboutit pas le laisse
   * faux : la coque affiche déjà le signalement, l'écran ne prétend pas que l'objectif n'existe pas.
   */
  private readonly loadSettled = linkedSignal<RequestStatus, boolean>({
    source: this.store.requestStatus,
    computation: (status, previous) => previous?.value === true || status === 'fulfilled',
  });

  /** Introuvable une fois les objectifs chargés ; jamais pendant le chargement. */
  protected readonly notFound = computed(() => {
    // Lu en premier : tant que l'objectif n'est pas affiché, la mémoire suit chaque changement de requestStatus.
    const settled = this.loadSettled();
    // Des objectifs déjà là prouvent que le chargement a eu lieu (une écriture peut être en cours).
    const loaded = settled || this.store.objectiveOptions().length > 0;
    return loaded && !this.detail();
  });

  /** Le titre de l'objectif dans le fil d'Ariane. */
  protected readonly crumb = computed(() => shortTitle(this.detail()?.objective.title ?? ''));

  /** « 6 étapes », pour le titre de l'arête. */
  protected readonly stageCount = computed(() => compter(this.detail()?.stages.length ?? 0, 'étape'));

  /** Les étapes pour l'arête ; une étape sans nom y reste lisible. */
  protected readonly aretes = computed<AreteStageViewModel[]>(() =>
    (this.detail()?.aretes ?? []).map((arete) => (arete.nom.trim() ? arete : { ...arete, nom: UNTITLED_STAGE })),
  );

  /**
   * L'id de l'étape ouverte à droite de l'arête : d'abord celle en cours. Elle reste ouverte tant qu'elle
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
    this.annonces.annoncer(`Étape ${stage.index} · ${STAGE_STATE_LABELS[stage.state]} : ${stageName(stage.title)}`);
  }

  /**
   * Au-delà de 8 étapes, Empreinte replie les étapes faites dans une arête « Faites » sans id. Chaque choix
   * de cette arête ouvre l'étape faite d'avant, en partant de la plus récente : toutes restent atteignables.
   */
  private foldedDoneStageId(stages: readonly StageViewModel[]): string | null {
    const done = stages.filter((stage) => stage.state === 'faite');
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
