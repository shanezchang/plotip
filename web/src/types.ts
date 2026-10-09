export type Place = {
  latitude: number;
  longitude: number;
  level: "city" | "region" | "country";
  name: string;
  source: string;
  timezone?: string;
  region_id?: string;
  bounds?: [number, number, number, number];
};
export type Result = {
  ip: string;
  version: number;
  scope: string;
  country: string | null;
  region: string | null;
  city: string | null;
  isp: string | null;
  country_code: string | null;
  location: Place | null;
  data_version: string;
};
export type Lang = "zh" | "en";

export type Area = {
  id: string;
  level: "country" | "region";
  country_code: string;
  name: string;
  zh: string;
  bounds: [number, number, number, number];
};
export type RangeItem = {
  id: number;
  start: string;
  end: string;
  cidrs: string[];
  region: string | null;
  city: string | null;
  isp: string | null;
  address_count: string;
};
export type RangePage = {
  area: Area;
  version: 4 | 6;
  items: RangeItem[];
  total_ranges: number;
  address_count: string;
  next_cursor: number | null;
  data_version: string;
};
