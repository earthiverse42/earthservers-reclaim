// Knowledge Graph - Personal memory and semantic search
// Manages browsing history, notes, and knowledge connections

export interface Page {
  id?: number;
  url: string;
  title: string;
  content: string;
  visitedAt: string;
  embedding?: number[];
}

export interface Note {
  id?: number;
  pageId: number;
  content: string;
  createdAt: string;
}

export interface Connection {
  fromPageId: number;
  toPageId: number;
  similarity: number;
}

export class KnowledgeGraph {
  private pages: Map<number, Page>;
  private notes: Map<number, Note>;
  private connections: Connection[];
  private nextPageId: number;
  private nextNoteId: number;

  constructor() {
    this.pages = new Map();
    this.notes = new Map();
    this.connections = [];
    this.nextPageId = 1;
    this.nextNoteId = 1;
  }

  addPage(page: Omit<Page, 'id'>): Page {
    const newPage: Page = {
      ...page,
      id: this.nextPageId++,
    };
    this.pages.set(newPage.id!, newPage);
    return newPage;
  }

  getPage(id: number): Page | undefined {
    return this.pages.get(id);
  }

  getPageByUrl(url: string): Page | undefined {
    return Array.from(this.pages.values()).find((p) => p.url === url);
  }

  getAllPages(): Page[] {
    return Array.from(this.pages.values());
  }

  addNote(note: Omit<Note, 'id'>): Note {
    const newNote: Note = {
      ...note,
      id: this.nextNoteId++,
    };
    this.notes.set(newNote.id!, newNote);
    return newNote;
  }

  getNotesForPage(pageId: number): Note[] {
    return Array.from(this.notes.values()).filter((n) => n.pageId === pageId);
  }

  // Cosine similarity between two embedding vectors
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Find related pages using embeddings
  findRelatedPages(pageId: number, topK: number = 5): Page[] {
    const page = this.getPage(pageId);
    if (!page || !page.embedding) return [];

    const similarities: Array<{ page: Page; similarity: number }> = [];

    this.pages.forEach((otherPage) => {
      if (otherPage.id !== pageId && otherPage.embedding) {
        const similarity = this.cosineSimilarity(page.embedding!, otherPage.embedding);
        similarities.push({ page: otherPage, similarity });
      }
    });

    // Sort by similarity and return top K
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map((s) => s.page);
  }

  // Semantic search across all pages
  async searchPages(query: string, topK: number = 10): Promise<Page[]> {
    // TODO: Generate embedding for query using AI runtime
    // TODO: Compare with page embeddings
    // For now, simple text search
    const lowerQuery = query.toLowerCase();
    return this.getAllPages().filter(
      (p) =>
        p.title.toLowerCase().includes(lowerQuery) ||
        p.content.toLowerCase().includes(lowerQuery)
    );
  }
}

export default KnowledgeGraph;
