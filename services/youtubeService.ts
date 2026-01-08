export class YouTubeService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchVideo(query: string): Promise<string | null> {
    if (!this.apiKey) return null;

    try {
      // Added videoEmbeddable=true to ensure the returned video can be played in an iframe
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(
        query
      )}&type=video&videoEmbeddable=true&key=${this.apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.items && data.items.length > 0) {
        return data.items[0].id.videoId;
      }
      return null;
    } catch (error) {
      console.error("YouTube Search Error:", error);
      return null;
    }
  }
}
