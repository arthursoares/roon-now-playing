// Type declarations for Roon API packages
// These packages don't ship with TypeScript definitions

declare module 'node-roon-api' {
  interface RoonApiOptions {
    extension_id: string;
    display_name: string;
    display_version: string;
    publisher: string;
    email: string;
    website?: string;
    core_paired?: (core: RoonCore) => void;
    core_unpaired?: (core: RoonCore) => void;
    core_found?: (core: RoonCore) => void;
    core_lost?: (core: RoonCore) => void;
  }

  interface RoonCore {
    core_id: string;
    display_name: string;
    display_version: string;
    services: Record<string, unknown>;
  }

  interface RoonApiInitServices {
    required_services?: unknown[];
    optional_services?: unknown[];
    provided_services?: unknown[];
  }

  class RoonApi {
    constructor(options: RoonApiOptions);
    init_services(services: RoonApiInitServices): void;
    start_discovery(): void;
    save_config(key: string, value: unknown): void;
    load_config(key: string): unknown;
  }

  export = RoonApi;
}

declare module 'node-roon-api-transport' {
  interface Zone {
    zone_id: string;
    display_name: string;
    state: 'playing' | 'paused' | 'loading' | 'stopped';
    is_next_allowed?: boolean;
    is_previous_allowed?: boolean;
    is_pause_allowed?: boolean;
    is_play_allowed?: boolean;
    is_seek_allowed?: boolean;
    queue_items_remaining?: number;
    queue_time_remaining?: number;
    settings?: {
      loop?: 'disabled' | 'loop' | 'loop_one';
      shuffle?: boolean;
      auto_radio?: boolean;
    };
    now_playing?: NowPlaying;
    seek_position?: number;
    outputs?: Output[];
  }

  interface NowPlaying {
    seek_position?: number;
    length?: number;
    image_key?: string;
    one_line?: { line1: string };
    two_line?: { line1: string; line2: string };
    three_line?: { line1: string; line2: string; line3: string };
  }

  interface Output {
    output_id: string;
    zone_id: string;
    can_group_with_output_ids?: string[];
    display_name: string;
    state?: 'playing' | 'loading';
    volume?: {
      type: 'number' | 'incremental' | 'db';
      min?: number;
      max?: number;
      value?: number;
      step?: number;
      is_muted?: boolean;
      hard_limit_min?: number;
      hard_limit_max?: number;
      soft_limit?: number;
    };
    source_controls?: SourceControl[];
  }

  interface SourceControl {
    control_key: string;
    display_name: string;
    supports_standby?: boolean;
    status: 'selected' | 'deselected' | 'standby' | 'indeterminate';
  }

  interface SubscribeZonesCallback {
    (
      cmd: 'Subscribed' | 'Changed',
      data: {
        zones?: Zone[];
        zones_added?: Zone[];
        zones_changed?: Zone[];
        zones_removed?: string[];
        zones_seek_changed?: Array<{ zone_id: string; seek_position: number; queue_time_remaining: number }>;
      }
    ): void;
  }

  class RoonApiTransport {
    subscribe_zones(callback: SubscribeZonesCallback): void;
    get_zones(callback: (error: Error | null, zones: Zone[]) => void): void;
    control(zone_or_output: Zone | Output | string, control: 'play' | 'pause' | 'playpause' | 'stop' | 'previous' | 'next', callback?: (error: Error | null) => void): void;
    seek(zone_or_output: Zone | Output | string, how: 'relative' | 'absolute', seconds: number, callback?: (error: Error | null) => void): void;
  }

  export = RoonApiTransport;
  export { Zone, NowPlaying, Output };
}

declare module 'node-roon-api-image' {
  interface ImageOptions {
    scale?: 'fit' | 'fill' | 'stretch';
    width?: number;
    height?: number;
    format?: 'image/jpeg' | 'image/png';
  }

  class RoonApiImage {
    get_image(
      image_key: string,
      options: ImageOptions,
      callback: (error: Error | null, content_type: string, body: Buffer) => void
    ): void;
  }

  export = RoonApiImage;
}

declare module 'node-roon-api-status' {
  import type RoonApi from 'node-roon-api';

  class RoonApiStatus {
    constructor(roon: RoonApi);
    set_status(message: string, is_error: boolean): void;
  }

  export = RoonApiStatus;
}
