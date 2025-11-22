// Types
export interface Rating {
  id: number;
  domain_url: string;
  user_hash: string;
  trust_level: number;
  bias_level: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface RatingAggregate {
  domain_url: string;
  avg_trust_level: number;
  avg_bias_level: number;
  total_ratings: number;
  trust_distribution: Record<string, number>;
  bias_distribution: Record<string, number>;
}

export interface SubmitRatingRequest {
  domain_url: string;
  user_hash: string;
  trust_level: number;
  bias_level: number;
  comment?: string;
}

export interface VoteRequest {
  voter_hash: string;
  is_helpful: boolean;
}

export interface ReportRequest {
  reporter_hash: string;
  reason: string;
}

// Client
export class RatingsApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new ApiError(response.status, await response.text());
    }

    return response.json();
  }

  // Submit or update a rating
  async submitRating(request: SubmitRatingRequest): Promise<Rating> {
    return this.request<Rating>('/api/ratings', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Get aggregate rating for a domain
  async getDomainRating(domain: string): Promise<RatingAggregate | null> {
    try {
      return await this.request<RatingAggregate>(
        `/api/ratings/${encodeURIComponent(domain)}`
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // Get individual reviews for a domain
  async getDomainReviews(domain: string): Promise<Rating[]> {
    return this.request<Rating[]>(
      `/api/ratings/${encodeURIComponent(domain)}/reviews`
    );
  }

  // Vote on a rating (helpful/not helpful)
  async voteOnRating(ratingId: number, request: VoteRequest): Promise<void> {
    await this.request(`/api/ratings/${ratingId}/vote`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Report a rating
  async reportRating(ratingId: number, request: ReportRequest): Promise<void> {
    await this.request(`/api/ratings/${ratingId}/report`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Error class
export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    super(`API Error ${status}: ${body}`);
    this.name = 'ApiError';
  }
}

// Utility: Generate user hash from identifier
export async function generateUserHash(identifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(identifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Default export
export default RatingsApiClient;
