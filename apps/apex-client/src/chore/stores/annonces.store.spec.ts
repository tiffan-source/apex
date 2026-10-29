import { TestBed } from '@angular/core/testing';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { AnnoncesStore } from './annonces.store';

describe('AnnoncesStore', () => {
  let announce: ReturnType<typeof vi.fn>;
  let store: InstanceType<typeof AnnoncesStore>;

  beforeEach(() => {
    announce = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [{ provide: LiveAnnouncer, useValue: { announce } }],
    });
    store = TestBed.inject(AnnoncesStore);
  });

  it('commence sans signalement', () => {
    expect(store.signalement()).toBeNull();
    expect(store.aUnSignalement()).toBe(false);
  });

  it('annoncer() parle aux lecteurs d’écran poliment, sans rien garder à afficher', () => {
    store.annoncer('Étape ajoutée.');
    expect(announce).toHaveBeenCalledWith('Étape ajoutée.', 'polite');
    expect(store.signalement()).toBeNull();
  });

  it('signaler() garde le texte pour la coque et l’annonce sans attendre', () => {
    store.signaler("Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie.");
    expect(store.signalement()).toBe("Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie.");
    expect(store.aUnSignalement()).toBe(true);
    expect(announce).toHaveBeenCalledWith(
      "Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie.",
      'assertive',
    );
  });

  it('un nouveau signalement remplace le précédent', () => {
    store.signaler('Premier.');
    store.signaler('Second.');
    expect(store.signalement()).toBe('Second.');
  });

  it('ne réannonce pas la phrase déjà affichée, mais la redit après « Compris »', () => {
    const phrase = "Je n'ai pas pu déplacer ce pas. Vérifie ta connexion, puis réessaie.";
    store.signaler(phrase);
    store.signaler(phrase);
    store.signaler(phrase);
    expect(announce).toHaveBeenCalledTimes(1);
    store.compris();
    store.signaler(phrase);
    expect(announce).toHaveBeenCalledTimes(2);
    expect(store.signalement()).toBe(phrase);
  });

  it('retirer() efface la note de ce souci-là seulement', () => {
    store.signaler('Je réessaie.');
    store.retirer('Autre chose.');
    expect(store.signalement()).toBe('Je réessaie.');
    store.retirer('Je réessaie.');
    expect(store.signalement()).toBeNull();
  });

  it('compris() efface le signalement', () => {
    store.signaler('Je ne retrouve plus ce pas. Recharge la page, puis réessaie.');
    store.compris();
    expect(store.signalement()).toBeNull();
    expect(store.aUnSignalement()).toBe(false);
  });

  it('ignore un texte vide', () => {
    store.annoncer('   ');
    store.signaler('');
    expect(announce).not.toHaveBeenCalled();
    expect(store.signalement()).toBeNull();
  });
});
