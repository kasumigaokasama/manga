import { Injectable } from '@angular/core'

export type ChapterRef = { slug: string; chapter: string; url: string; title: string; pages?: number }

@Injectable({ providedIn: 'root' })
export class ChapterService {
  getChapter(slug: string, chapter: string): ChapterRef {
    const url = `/assets/manga/${encodeURIComponent(slug)}/${encodeURIComponent(chapter)}.pdf`
    return { slug, chapter, url, title: `${slug} – ${chapter}` }
  }
  private progressKey(ref: ChapterRef) { return `manga-reader:${ref.slug}:${ref.chapter}` }
  loadProgress(ref: ChapterRef): number {
    const v = localStorage.getItem(this.progressKey(ref))
    const n = Number(v || '1')
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
  }
  saveProgress(ref: ChapterRef, page: number) {
    localStorage.setItem(this.progressKey(ref), String(Math.max(1, Math.floor(page))))
  }
}

