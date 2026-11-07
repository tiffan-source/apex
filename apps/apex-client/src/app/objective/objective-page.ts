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
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import type { ComponentType } from '@angular/cdk/portal';
import { compter } from '@empreinte-studio/angular/core';
import { EArete, ELegendeArete, type EtapeArete } from '@empreinte-studio/angular/arete';
import { EBouton } from '@empreinte-studio/angular/bouton';
import { Confirmations, EConfirmation } from '@empreinte-studio/angular/confirmation';
import { Feuilles } from '@empreinte-studio/angular/feuille';
import { EIcone } from '@empreinte-studio/angular/icone';
import { EFilAriane } from '@empreinte-studio/angular/navigation';
import { ENote, ENoteActions } from '@empreinte-studio/angular/note';
import { EPas } from '@empreinte-studio/angular/pas';
import { EListe, ETache, ETacheActions } from '@empreinte-studio/angular/tache';
import { ETrace } from '@empreinte-studio/angular/trace';
import { AnnoncesStore } from '../../chore/stores/annonces.store';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { stageDetail, stageIdFromArete } from '../../chore/mapper/objective-view.mapper';
import { CRUMB_TITLE_MAX, shortTitle } from '../../chore/mapper/title.mapper';
import { isTemporaryId } from '../../chore/stores/utils/map-optimistique-id';
import { WriteQueue } from '../../chore/stores/utils/write-queue';
import type { StageTaskViewModel, StageViewModel } from '../../chore/models/objective-detail.viewmodel';
import { AddStageSheet, type AddStageSheetData } from './sheets/add-stage-sheet';
import { AddTaskSheet, type AddTaskSheetData } from './sheets/add-task-sheet';
import { EditObjectiveSheet, type EditObjectiveSheetData, type EditObjectiveSheetResult } from './sheets/edit-objective-sheet';
import { EditStageSheet, type EditStageSheetData } from './sheets/edit-stage-sheet';
import { EditTaskSheet, type EditTaskSheetData } from './sheets/edit-task-sheet';
import { stageAccomplishment, stageName, stageStateLabel } from './stage-labels';
import { OBJECTIVE_ERASURE, STAGE_ERASURE, objectiveErasureText, stageErasureText } from './erase-labels';

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
 *
 * Effacer a trois poids (maquette « Effacer ») : un pas part tout de suite et laisse sa trace le temps de le
 * remettre ; une étape part après une validation sur place ; l'objectif part depuis le pied de la feuille qui le
 * modifie, quand on a réécrit son nom.
 */
@Component({
  selector: 'app-objective-page',
  imports: [
    RouterLink,
    EArete,
    EBouton,
    EConfirmation,
    EFilAriane,
    EIcone,
    ELegendeArete,
    EListe,
    ENote,
    ENoteActions,
    EPas,
    ETache,
    ETacheActions,
    ETrace,
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
  private readonly confirmations = inject(Confirmations);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  protected readonly stageStateLabel = stageStateLabel;
  protected readonly stageAccomplishment = stageAccomplishment;
  /** La coque affiche un signalement (une note d'Akari) : l'écran n'en pose pas une seconde. */
  protected readonly hasReport = this.annonces.aUnSignalement;
  protected readonly stageName = stageName;
  protected readonly stageErasure = STAGE_ERASURE;
  /** Un pas qui n'est pas encore enregistré n'a pas de × : sa trace ne survivrait pas à son id définitif. */
  protected readonly isTemporaryId = isTemporaryId;

  /** Les titres où poser le focus quand le bouton qui a ouvert une feuille a disparu. */
  private readonly pageHeading = viewChild<ElementRef<HTMLElement>>('pageHeading');
  private readonly stageHeading = viewChild<ElementRef<HTMLElement>>('stageHeading');
  /** Le titre de l'arête, où la suite se lit quand une étape vient de partir. */
  private readonly areteHeading = viewChild<ElementRef<HTMLElement>>('areteHeading');
  /** « Effacer l'étape » : la validation gardée, le focus y revient (la validation l'avait remplacé). */
  private readonly stageExit = viewChild('stageExit', { read: ElementRef<HTMLButtonElement> });

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

  /**
   * Le pas dont la trace est à l'écran : effacé pour la personne, pas encore pour l'API. Il reste dans le store (un
   * rechargement le rendrait) : c'est l'écran qui montre sa trace à sa place, et ne le compte plus. Une trace à la
   * fois, comme dans la maquette.
   */
  protected readonly erasingTaskId = signal<string | null>(null);
  /** Le dernier pas remis à sa place par sa trace : il reprend le focus en revenant. */
  protected readonly restoredTaskId = signal<string | null>(null);

  /**
   * La validation de l'effacement de l'étape ouverte est dépliée. Elle se replie quand une autre étape s'ouvre, pas
   * quand l'étape reçoit son id définitif (son enregistrement aboutit pendant la validation).
   */
  protected readonly confirmingStageErasure = linkedSignal<string | null, boolean>({
    source: this.openStageId,
    computation: (stageId, previous) =>
      !!previous?.value &&
      previous.source !== null &&
      stageId !== null &&
      this.writes.resolve(previous.source) === stageId,
  });

  /** Les étapes de l'arête ; pendant la validation, l'étape ouverte sort du plan, en pointillés. */
  protected readonly aretes = computed(() => {
    const aretes = this.detail()?.aretes ?? [];
    const leaving = this.confirmingStageErasure() ? this.openStageId() : null;
    return leaving === null ? aretes : aretes.map((arete) => (arete.id === leaving ? { ...arete, sortante: true } : arete));
  });

  /** Ce que l'étape ouverte compte, sans le pas qui vient d'être effacé (sa trace est à l'écran). */
  protected readonly stageProgress = computed(() => {
    const stage = this.stage();
    if (!stage) return null;
    const erasing = this.erasingTaskId();
    const kept = stage.tasks.filter((task) => task.id !== erasing);
    const done = kept.filter((task) => task.done).length;
    const progress = { done, toDo: kept.length - done };
    return { ...progress, total: kept.length, detail: stageDetail(progress) };
  });

  /** Ce que l'effacement de l'étape ouverte emporte, pour sa validation. */
  protected readonly stageErasureText = computed(() => {
    const progress = this.stageProgress();
    const stageCount = this.detail()?.stages.length ?? 0;
    return progress ? stageErasureText({ done: progress.done, total: progress.total }, stageCount) : '';
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

  /**
   * Le × d'un pas : il part tout de suite, et sa trace laisse le temps de le remettre. Une trace à la fois : le pas
   * dont la trace était là part pour de bon (sa trace, retirée, le redit en partant ; le store l'ignore).
   */
  protected eraseTask(taskId: string): void {
    const previous = this.erasingTaskId();
    this.restoredTaskId.set(null);
    this.erasingTaskId.set(taskId);
    if (previous !== null && previous !== taskId) this.store.deleteTask(previous);
  }

  /** « Remettre » : le pas revient à sa place, avec le focus. */
  protected putBackTask(taskId: string): void {
    this.restoredTaskId.set(taskId);
    if (this.erasingTaskId() === taskId) this.erasingTaskId.set(null);
  }

  /**
   * La trace s'en va (son délai est passé, une autre étape s'ouvre, la page est quittée ou cachée) : le pas est
   * effacé pour de bon. Une trace remplacée le redit en partant : son pas est déjà parti, rien n'est renvoyé. Le
   * store ignore aussi un pas qui n'est plus là (une étape déjà partie).
   */
  protected eraseTaskForGood(taskId: string): void {
    if (this.erasingTaskId() !== taskId) return;
    this.erasingTaskId.set(null);
    this.store.deleteTask(taskId);
  }

  /** Un autre effacement commence (l'étape, l'objectif) : le pas qui attendait part d'abord, pour de bon. */
  private eraseWaitingTask(): void {
    const waiting = this.erasingTaskId();
    if (waiting !== null) this.eraseTaskForGood(waiting);
  }

  /** « Garder l'étape », ou Échap : la validation se replie, et le focus revient au geste qui l'avait ouverte. */
  protected keepStage(): void {
    this.confirmingStageErasure.set(false);
    afterNextRender(() => this.stageExit()?.nativeElement.focus(), { injector: this.injector });
  }

  /**
   * La validation est confirmée : l'étape part avec ses pas. Son panneau se referme, et le focus va où la suite se
   * lit : le titre de l'arête, sinon celui de l'objectif (sa dernière étape est partie).
   */
  protected eraseStage(stageId: string): void {
    this.eraseWaitingTask();
    this.openStageId.set(null);
    this.store.deleteObjective(stageId);
    afterNextRender(() => (this.areteHeading() ?? this.pageHeading())?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  protected editObjective(): void {
    const objective = this.detail()?.objective;
    if (!objective) return;
    this.open<EditObjectiveSheet, EditObjectiveSheetData, EditObjectiveSheetResult>(
      EditObjectiveSheet,
      {
        objective: {
          id: objective.id,
          title: objective.title,
          description: objective.description,
          why: objective.why,
          dueDate: objective.dueDate,
        },
      },
      // La sortie discrète de la feuille : effacer l'objectif, après sa confirmation.
      (result) => result === 'erase' && this.askObjectiveErasure(),
    );
  }

  /**
   * La feuille de confirmation de l'effacement de l'objectif : ce qu'il emporte, et son nom à réécrire. Confirmé,
   * l'objectif part une fois la liste des objectifs ouverte : l'arête ne dit jamais « introuvable » entre-temps.
   * Gardé, le focus revient au bouton « Modifier l'objectif » (le CDK l'y rend).
   */
  private askObjectiveErasure(): boolean {
    const detail = this.detail();
    if (!detail) return false;
    const { id, title } = detail.objective;
    const erasing = this.erasingTaskId();
    const tasks = [...detail.stages.flatMap((stage) => stage.tasks), ...detail.tasksWithoutStage].filter(
      (task) => task.id !== erasing,
    );
    this.confirmations
      .demander({
        titre: OBJECTIVE_ERASURE.question,
        texte: objectiveErasureText(detail.stages.length, {
          done: tasks.filter((task) => task.done).length,
          total: tasks.length,
        }),
        libelleConfirmer: OBJECTIVE_ERASURE.confirm,
        libelleAnnuler: OBJECTIVE_ERASURE.keep,
        aReecrire: title,
      })
      .closed.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((choice) => {
        if (choice === 'confirmer') {
          this.eraseWaitingTask();
          // Si la liste ne s'ouvre pas (hors connexion, son code n'est pas chargé), l'objectif part quand même : le
          // geste est confirmé, et l'arête dira qu'il n'est plus là.
          void this.router
            .navigateByUrl('/')
            .catch(() => false)
            .then(() => this.store.deleteObjective(id));
          return;
        }
        afterNextRender(() => this.recoverFocus(), { injector: this.injector });
      });
    return true;
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
   * introuvable. À la fermeture, le CDK rend le focus au bouton qui l'a ouverte. `onClosed` reçoit ce que la feuille
   * rend ; s'il ouvre une autre feuille (il rend vrai), c'est elle qui s'occupe du focus.
   */
  private open<C, D, R = unknown>(
    component: ComponentType<C>,
    donnees: D,
    onClosed?: (result: R | undefined) => boolean,
  ): void {
    this.feuilles
      .ouvrir<C, D, R>(component, { donnees, cdk: { injector: this.injector } })
      .closed.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (onClosed?.(result)) return;
        afterNextRender(() => this.recoverFocus(), { injector: this.injector });
      });
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
