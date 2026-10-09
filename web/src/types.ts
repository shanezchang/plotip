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
