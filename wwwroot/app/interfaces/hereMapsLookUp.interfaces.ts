export interface HereMapsLookupResponse {
  title: string;
  id: string;
  closedPermanently?: "maybe" | "yes";
  politicalView?: string;
  resultType?: "addressBlock" | "administrativeArea" | "houseNumber" | "intersection" | "locality" | "place" | "postalCodePoint" | "street";
  houseNumberType?: "MPA" | "PA" | "interpolated";
  addressBlockType?: "block" | "subblock";
  localityType?: "city" | "district" | "postalCode" | "subdistrict";
  administrativeAreaType?: "country" | "county" | "state";
  houseNumberFallback?: boolean;
  estimatedPointAddress?: boolean;
  address: HereMapsAddress;
  postalCodeDetails?: Array<PostalCodeDetailsUspsZip | PostalCodeDetailsUspsZipPlus4>;
  position: Position;
  access?: Array<HereMapsAccess>;
  mapView?: MapView;
  categories?: Array<HereMapsCategory>;
  chains?: Array<HereMapsChain>;
  references?: Array<HereMapsReference>;
  foodTypes?: Array<HereMapsFoodType>;
  contacts?: Array<HereMapsContact>;
  openingHours?: Array<HereMapsOpeningHours>;
  timeZone?: HereMapsTimeZone;
  media?: HereMapsMedia;
  extended?: HereMapsExtended;
  phonemes?: HereMapsPhonemes;
  streetInfo?: Array<HereMapsStreetInfo>;
  countryInfo?: HereMapsCountryInfo;
  mapReferences?: HereMapsMapReferences;
  related?: Array<HereMapsRelated>;
  navigationAttributes?: HereMapsNavigationAttributes;
  accessRestrictions?: Array<HereMapsAccessRestriction>;
}

export interface HereMapsAddress {
  label: string;
  countryCode: string;
  countryName: string;
  stateCode?: string;
  state?: string;
  county?: string;
  city?: string;
  district?: string;
  street?: string;
  postalCode?: string;
  houseNumber?: string;
}

export interface Position {
  lat: number;
  lng: number;
}

export interface MapView {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface HereMapsAccess {
  position: Position;
  type?: string;
  label?: string;
  primary?: boolean;
}

export interface HereMapsCategory {
  id: string;
  name: string;
  primary?: boolean;
}

export interface HereMapsChain {
  id: string;
  name: string;
}

export interface HereMapsReference {
  supplier: {
    id: string;
  };
  id: string;
}

export interface HereMapsFoodType {
  id: string;
  name: string;
  primary?: boolean;
}

export interface HereMapsContact {
  phone?: Array<{ value: string; categories?: Array<string> }>;
  mobile?: Array<{ value: string; categories?: Array<string> }>;
  fax?: Array<{ value: string; categories?: Array<string> }>;
  email?: Array<{ value: string; categories?: Array<string> }>;
  www?: Array<{ value: string; categories?: Array<string> }>;
}

export interface HereMapsOpeningHours {
  text?: string;
  isOpen?: boolean;
  structured?: Array<{
    start: string;
    duration: string;
    recurrence: string;
  }>;
}

export interface HereMapsTimeZone {
  name: string;
  offset: number;
  offsetSeconds: number;
  rawOffset: number;
  rawOffsetSeconds: number;
  dstOffset: number;
  dstOffsetSeconds: number;
  utc: string;
  id: string;
}

export interface HereMapsMedia {
  images?: {
    tripadvisor?: Array<{
      url: string;
      width: number;
      height: number;
    }>;
  };
  ratings?: {
    tripadvisor?: {
      value: number;
      max: number;
      count: number;
    };
  };
  descriptions?: {
    tripadvisor?: {
      text: string;
    };
  };
}

export interface HereMapsExtended {
  evStation?: any;
  evAvailability?: any;
}

export interface HereMapsPhonemes {
  addressName?: string;
  placeName?: string;
}

export interface HereMapsStreetInfo {
  baseName: string;
  streetType?: string;
  streetTypePrecedes?: boolean;
  streetTypeAttached?: boolean;
  prefix?: string;
  suffix?: string;
  direction?: string;
  language?: string;
}

export interface HereMapsCountryInfo {
  alpha2: string;
  alpha3: string;
}

export interface HereMapsMapReferences {
  adminIds?: Array<{
    locId: string;
    adminLevel: number;
  }>;
  cmVersion?: string;
  links?: Array<{
    linkId: string;
    mappedPosition: Position;
  }>;
  pointAddress?: {
    addressId: string;
    buildingId?: string;
    buildingName?: string;
  };
  segments?: Array<{
    id: string;
    mappedPosition: Position;
    functionalClass?: number;
  }>;
}

export interface HereMapsRelated {
  parentPA?: {
    id: string;
    address: HereMapsAddress;
    position: Position;
    access?: Array<HereMapsAccess>;
  };
  MPA?: Array<{
    id: string;
    title: string;
    address: HereMapsAddress;
    position: Position;
    access?: Array<HereMapsAccess>;
  }>;
}

export interface HereMapsNavigationAttributes {
  access?: any;
  functionalClass?: any;
  physical?: any;
  speedLimits?: any;
}

export interface HereMapsAccessRestriction {
  type: string;
  description: string;
}

export interface PostalCodeDetailsUspsZip {
  type: "ZIP";
  context?: {
    classificationCode?: {
      name: string;
      code: string;
    };
  };
}

export interface PostalCodeDetailsUspsZipPlus4 {
  type: "ZIP+4";
  context?: {
    recordTypeCode?: {
      name: string;
      code: string;
    };
  };
}