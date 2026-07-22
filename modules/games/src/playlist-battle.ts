/** A song with its accumulated votes in a playlist battle. */
export interface SongVotes {
  readonly songId: string;
  readonly votes: number;
}

/** A ranked song with its 1-based position. Pure and deterministic. */
export interface SongRank {
  readonly songId: string;
  readonly votes: number;
  readonly rank: number;
}

/**
 * Ranks songs in a playlist battle by votes descending, breaking ties by
 * songId ascending, and assigns 1-based ranks in that order. Does not mutate
 * the input. Pure and deterministic.
 */
export const resolvePlaylistBattle = (
  songs: readonly SongVotes[],
): readonly SongRank[] =>
  [...songs]
    .sort((a, b) => {
      if (b.votes !== a.votes) {
        return b.votes - a.votes;
      }
      return a.songId < b.songId ? -1 : a.songId > b.songId ? 1 : 0;
    })
    .map((song, index) => ({
      songId: song.songId,
      votes: song.votes,
      rank: index + 1,
    }));
