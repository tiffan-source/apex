import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import { Marked } from 'marked';

/*
 * Le Markdown des répliques, rendu en HTML puis assaini par DOMPurify avant d'entrer dans la page.
 * - Un titre Markdown devient un paragraphe en gras : la page a déjà son titre (h1), et la réplique garde sa
 *   typographie (la prose d'Empreinte ne touche pas aux tailles).
 * - Pas d'italique (brand book, Typographie) : *mot* et _mot_ restent du texte droit, et les em, i et titres
 *   écrits en HTML sont retirés, leur texte gardé.
 * - Un retour à la ligne simple est gardé (Maj+Entrée dans la zone de réponse).
 * - Ni style, ni classe, ni identifiant venus du texte : l'apparence vient d'Empreinte (la prose d'une
 *   réplique : paragraphes, listes, liens à l'encre du texte, code).
 * - Rien ne se charge tout seul depuis une réplique : une image Markdown devient un lien vers elle, que la
 *   personne choisit d'ouvrir, et les images, vidéos et sons écrits en HTML sont retirés, comme les attributs
 *   qui chargent une image de fond (background d'un tableau) ou d'aperçu. Sinon, une adresse écrite par l'IA
 *   serait appelée dès l'affichage, avec ce qu'elle contient.
 */
const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const markdown = new Marked({
  async: false,
  gfm: true,
  breaks: true,
  renderer: {
    heading({ tokens }) {
      return `<p><strong>${this.parser.parseInline(tokens)}</strong></p>\n`;
    },
    image({ href, text }) {
      return `<a href="${escapeHtml(href)}">${escapeHtml(text || href)}</a>`;
    },
    em({ tokens }) {
      return this.parser.parseInline(tokens);
    },
  },
});

const purifier = DOMPurify(window);

const PURIFY_OPTIONS = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: [
    'style', 'form', 'input', 'button', 'textarea', 'select', 'img', 'picture', 'source', 'video', 'audio', 'track',
    'em', 'i', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  ],
  FORBID_ATTR: ['style', 'class', 'id', 'background', 'poster', 'srcset'],
};

/** Le HTML assaini d'un texte Markdown. */
export function renderMarkdown(value: string): string {
  if (!value) return '';
  const html = markdown.parse(value) as string;
  return purifier.sanitize(html, PURIFY_OPTIONS);
}

@Pipe({
  name: 'markdown',
  standalone: true
})
export class MarkdownPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(value: string): SafeHtml {
    if (!value) return '';
    // Le HTML vient d'être assaini par DOMPurify : Angular peut l'insérer tel quel.
    return this.sanitizer.bypassSecurityTrustHtml(renderMarkdown(value));
  }
}
