import { SecurityContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { MarkdownPipe, renderMarkdown } from './markdown.pipe';

/*
 * Le Markdown des répliques : rendu, puis assaini par DOMPurify avant d'entrer dans la page.
 */
describe('renderMarkdown', () => {
  it('rend le Markdown courant', () => {
    const html = renderMarkdown('Un **pas** à la fois.\n\n- Endurance\n- Vitesse');
    expect(html).toContain('<strong>pas</strong>');
    expect(html).toContain('<li>Endurance</li>');
  });

  it('garde un retour à la ligne simple (Maj+Entrée)', () => {
    expect(renderMarkdown('Première ligne\nDeuxième ligne')).toContain('<br>');
  });

  it('écrit un titre en paragraphe : la page a déjà son titre', () => {
    const html = renderMarkdown('# Les étapes\n\nTexte');
    expect(html).not.toMatch(/<h\d/);
    expect(html).toContain('<p><strong>Les étapes</strong></p>');
  });

  it('retire les scripts, les gestionnaires et les liens javascript:', () => {
    const html = renderMarkdown('<script>alert(1)</script><img src="x" onerror="alert(2)">\n\nVoir [ici](javascript:alert(3)).');
    expect(html).not.toMatch(/<script|onerror|javascript:/);
    expect(html).toContain('ici');
  });

  it('retire les styles, classes et identifiants venus du texte', () => {
    const html = renderMarkdown('<p style="color: red" class="rouge" id="contenu">Texte</p><style>p { color: red }</style>');
    expect(html).not.toMatch(/style|rouge|contenu/);
    expect(html).toContain('Texte');
  });

  it('retire les formulaires', () => {
    expect(renderMarkdown('<form><input name="x"><button>Envoyer</button></form>')).not.toMatch(/<form|<input|<button/);
  });

  it('ne charge rien tout seul : une image devient un lien, les médias écrits en HTML partent', () => {
    const html = renderMarkdown('Voici ![une carte](https://exemple.fr/carte.png?q=secret).');
    expect(html).not.toMatch(/<img/);
    expect(html).toContain('<a href="https://exemple.fr/carte.png?q=secret" class="ds-link">une carte</a>');

    const media = renderMarkdown('<img src="https://exemple.fr/x.png"><video src="v.mp4"></video><audio src="a.mp3"></audio><picture><source srcset="s.png"></picture>');
    expect(media).not.toMatch(/<img|<video|<audio|<picture|<source|exemple\.fr|v\.mp4|a\.mp3|s\.png/);
  });

  it('ne charge pas non plus d’image de fond : l’attribut background d’un tableau part', () => {
    const html = renderMarkdown('<table background="https://exemple.fr/p.gif"><tr><td background="https://exemple.fr/t.gif">x</td></tr></table>');
    expect(html).not.toMatch(/background|exemple\.fr/);
    expect(html).toContain('x');
  });

  it('n’écrit rien en italique, ni de titre écrit en HTML : le texte reste, droit', () => {
    const html = renderMarkdown('*a* _b_ <i>c</i> <em>d</em> <h2>e</h2>');
    expect(html).not.toMatch(/<em|<i>|<i |<h\d/);
    for (const letter of ['a', 'b', 'c', 'd', 'e']) expect(html).toContain(letter);
    expect(renderMarkdown('Voici une *première* étape, _vraiment_ simple.')).toBe('<p>Voici une première étape, vraiment simple.</p>\n');
  });

  it('ne laisse pas passer une image javascript:', () => {
    expect(renderMarkdown('![clic](javascript:alert(1))')).not.toMatch(/javascript:/);
  });

  it('donne aux liens l’encre du texte (.ds-link)', () => {
    expect(renderMarkdown('[Empreinte](https://exemple.fr)')).toContain('<a href="https://exemple.fr" class="ds-link">Empreinte</a>');
  });

  it('rend vide un texte vide', () => {
    expect(renderMarkdown('')).toBe('');
  });
});

describe('MarkdownPipe', () => {
  it('donne à Angular le HTML assaini', () => {
    TestBed.configureTestingModule({ providers: [MarkdownPipe] });
    const pipe = TestBed.inject(MarkdownPipe);
    const sanitizer = TestBed.inject(DomSanitizer);
    const safe = pipe.transform('**Oui**<script>alert(1)</script>');
    const html = sanitizer.sanitize(SecurityContext.HTML, safe) ?? '';
    expect(html).toContain('<strong>Oui</strong>');
    expect(html).not.toContain('<script');
    expect(pipe.transform('')).toBe('');
  });
});
