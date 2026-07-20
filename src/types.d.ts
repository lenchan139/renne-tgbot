declare module 'webtorrent' {
  export interface TorrentFile {
    name: string;
    path: string;
    length: number;
  }

  export interface Torrent {
    name: string;
    length: number;
    progress: number;
    downloadSpeed: number;
    files: TorrentFile[];
    on(event: string, cb: (...args: any[]) => void): void;
    destroy(cb?: () => void): void;
  }

  export interface AddOptions {
    path?: string;
    destroyStoreOnDestroy?: boolean;
  }

  export interface Instance {
    add(id: string | any, opts?: AddOptions): Torrent;
    destroy(cb?: () => void): void;
  }

  interface WebTorrentConstructor {
    new (): Instance;
  }

  const WebTorrent: WebTorrentConstructor;
  export default WebTorrent;
}

declare module 'parse-torrent' {
  export interface ParsedTorrent {
    info?: any;
    name?: string;
    infoHash?: string;
  }

  function parseTorrent(input: Buffer | string): ParsedTorrent;
  export default parseTorrent;
}
