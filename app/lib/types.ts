export interface Council {
  id: string;
  name: string;
  state: string;
  website_url: string;
  scraper_id: string;
}

export interface CollectionEvent {
  id: string;
  council_id: string;
  zone: string;
  date: string;
  bins: string[];
  is_holiday: boolean;
}

export interface User {
  id: string;
  address: string;
  council_id: string;
  collection_zone: string;
  push_token: string | null;
  notify_time: string;
}
