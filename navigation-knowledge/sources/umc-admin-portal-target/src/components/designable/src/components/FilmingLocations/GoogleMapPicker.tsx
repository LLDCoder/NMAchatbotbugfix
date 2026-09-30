import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/localization/config";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";

type GoogleLatLngLiteral = {
  lat: number;
  lng: number;
};

type GoogleLatLng = {
  lat: () => number;
  lng: () => number;
};

type GoogleMapMouseEvent = {
  latLng: GoogleLatLng | null;
};

type GoogleGeocoderRequest = {
  location?: GoogleLatLngLiteral;
  address?: string;
};

type GoogleGeocoderResult = {
  formatted_address: string;
  geometry?: {
    location?: GoogleLatLng;
  };
};

type GoogleMapInstance = {
  addListener: (eventName: string, handler: (event: GoogleMapMouseEvent) => void) => void;
  setCenter: (position: GoogleLatLngLiteral) => void;
  setZoom: (zoom: number) => void;
};

type GoogleMarkerInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
  setPosition: (position: GoogleLatLngLiteral) => void;
};

type GoogleMapsApi = {
  maps: {
    Map: new (
      element: HTMLElement,
      options: {
        center: GoogleLatLngLiteral;
        zoom: number;
        clickableIcons?: boolean;
        fullscreenControl?: boolean;
        mapTypeControl?: boolean;
        streetViewControl?: boolean;
      }
    ) => GoogleMapInstance;
    Marker: new (options: {
      map: GoogleMapInstance;
      position: GoogleLatLngLiteral;
    }) => GoogleMarkerInstance;
    Geocoder: new () => {
      geocode: (
        request: GoogleGeocoderRequest,
        callback: (results: GoogleGeocoderResult[] | null, status: string) => void
      ) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleMapsApi;
    __googleMapsInitMapPicker__?: () => void;
    gm_authFailure?: () => void;
  }
}

type GoogleMapPickerProps = {
  value?: string;
  latitude?: number;
  longitude?: number;
  onLocationSelect: (payload: {
    address?: string;
    latitude: number;
    longitude: number;
  }) => void;
};

const GOOGLE_MAP_SCRIPT_ID = "google-maps-script";
const DEFAULT_CENTER = { lat: 25.2048, lng: 55.2708 };
const MAP_INIT_RETRY_DELAY = 150;
const MAP_INIT_MAX_RETRIES = 20;

let googleMapsPromise: Promise<void> | null = null;
let googleMapsLanguage: "en" | "ar" | null = null;

const resetGoogleMapsScript = () => {
  document.getElementById(GOOGLE_MAP_SCRIPT_ID)?.remove();
  delete window.google;
  delete window.__googleMapsInitMapPicker__;
  delete window.gm_authFailure;
  googleMapsPromise = null;
  googleMapsLanguage = null;
};

const loadGoogleMapsScript = (
  apiKey: string,
  language: "en" | "ar",
): Promise<void> => {
  if (window.google?.maps) {
    if (googleMapsLanguage === language) {
      return Promise.resolve();
    }
    resetGoogleMapsScript();
  }

  if (googleMapsPromise) {
    return googleMapsPromise.then(() =>
      googleMapsLanguage === language
        ? undefined
        : loadGoogleMapsScript(apiKey, language),
    );
  }

  let existingScript = document.getElementById(GOOGLE_MAP_SCRIPT_ID) as
    | HTMLScriptElement
    | null;
  if (
    existingScript &&
    (existingScript.dataset.language !== language ||
      existingScript.dataset.loadState !== "loading")
  ) {
    existingScript.remove();
    existingScript = null;
  }

  googleMapsPromise = new Promise<void>((resolve, reject) => {
    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (window.google?.maps) {
          googleMapsLanguage = language;
          resolve();
          return;
        }

        resetGoogleMapsScript();
        reject(new Error("Google Maps script loaded but API is unavailable"));
      }, { once: true });
      existingScript.addEventListener(
        "error",
        () => {
          resetGoogleMapsScript();
          reject(new Error("Google Maps failed"));
        },
        { once: true },
      );
      return;
    }

    const authFailureHandler = () => {
      resetGoogleMapsScript();
      reject(new Error("Google Maps authentication failed"));
    };

    window.gm_authFailure = authFailureHandler;
    window.__googleMapsInitMapPicker__ = () => {
      const loadedScript = document.getElementById(GOOGLE_MAP_SCRIPT_ID);
      if (loadedScript instanceof HTMLScriptElement) {
        loadedScript.dataset.loadState = "loaded";
      }
      googleMapsLanguage = language;
      resolve();
      delete window.__googleMapsInitMapPicker__;
      delete window.gm_authFailure;
    };

    const script = document.createElement("script");
    script.id = GOOGLE_MAP_SCRIPT_ID;
    script.dataset.language = language;
    script.dataset.loadState = "loading";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&callback=__googleMapsInitMapPicker__&loading=async&language=${language}`;
    script.onerror = () => {
      resetGoogleMapsScript();
      reject(new Error("Google Maps failed"));
    };

    document.body.appendChild(script);
  });

  return googleMapsPromise;
};

const reverseGeocode = (
  geocoder: InstanceType<GoogleMapsApi["maps"]["Geocoder"]>,
  position: GoogleLatLngLiteral
) => {
  return new Promise<string>((resolve, reject) => {
    geocoder.geocode({ location: position }, (results, status) => {
      if (status === "OK" && results?.[0]?.formatted_address) {
        resolve(results[0].formatted_address);
        return;
      }

      reject(new Error(status || "Reverse geocoding failed"));
    });
  });
};

const geocodeAddress = (
  geocoder: InstanceType<GoogleMapsApi["maps"]["Geocoder"]>,
  address: string
) => {
  return new Promise<GoogleLatLngLiteral | null>((resolve) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status !== "OK" || !results?.[0]?.geometry?.location) {
        resolve(null);
        return;
      }

      const location = results[0].geometry.location;
      resolve({
        lat: location.lat(),
        lng: location.lng(),
      });
    });
  });
};

const waitForContainerReady = (
  element: HTMLDivElement,
  retries = MAP_INIT_MAX_RETRIES
): Promise<void> => {
  if (element.offsetWidth > 0 && element.offsetHeight > 0) {
    return Promise.resolve();
  }

  if (retries <= 0) {
    return Promise.reject(new Error("Map container is not visible yet"));
  }

  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      waitForContainerReady(element, retries - 1).then(resolve).catch(reject);
    }, MAP_INIT_RETRY_DELAY);
  });
};

const GoogleMapPicker: React.FC<GoogleMapPickerProps> = ({
  value,
  latitude,
  longitude,
  onLocationSelect,
}) => {
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const { i18n: i18nReact } = useTranslation();
  const previewLang =
    host === "designer"
      ? contentLang
      : mapDesignerLanguageToContentLang(i18nReact.language);
  const tx = React.useCallback(
    (key: string) =>
      String(i18n.t(`AddressList.${key}`, { lng: previewLang })),
    [previewLang],
  );
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markerRef = useRef<GoogleMarkerInstance | null>(null);
  const geocoderRef = useRef<InstanceType<GoogleMapsApi["maps"]["Geocoder"]> | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      setError(tx("mapLoadFailed"));
      return;
    }

    let active = true;

    const initMap = async () => {
      try {
        await loadGoogleMapsScript(apiKey, previewLang);

        if (!active || !mapContainerRef.current || !window.google?.maps) {
          return;
        }

        markerRef.current?.setMap(null);
        markerRef.current = null;
        mapRef.current = null;
        await waitForContainerReady(mapContainerRef.current);

        if (!active || !mapContainerRef.current || !window.google?.maps) {
          return;
        }

        const googleMaps = window.google.maps;
        const map = new googleMaps.Map(mapContainerRef.current, {
          center: DEFAULT_CENTER,
          zoom: 11,
          clickableIcons: false,
          fullscreenControl: true,
          mapTypeControl: false,
          streetViewControl: false,
        });

        const geocoder = new googleMaps.Geocoder();

        mapRef.current = map;
        geocoderRef.current = geocoder;
        setError("");

        window.setTimeout(() => {
          if (!active || !mapRef.current) {
            return;
          }

          mapRef.current.setCenter(DEFAULT_CENTER);
          mapRef.current.setZoom(11);
        }, 0);

        map.addListener("click", async (event) => {
          if (!event.latLng || !mapRef.current || !geocoderRef.current) {
            return;
          }

          const position = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng(),
          };

          if (!markerRef.current) {
            markerRef.current = new googleMaps.Marker({
              map: mapRef.current,
              position,
            });
          } else {
            markerRef.current.setPosition(position);
          }

          try {
            const address = await reverseGeocode(geocoderRef.current, position);
            onLocationSelect({
              address,
              latitude: position.lat,
              longitude: position.lng,
            });
            setError("");
          } catch {
            onLocationSelect({
              latitude: position.lat,
              longitude: position.lng,
            });
            setError(tx("mapAddressResolveFailed"));
          }
        });
      } catch (err) {
        if (active) {
          console.error("Failed to load Google Maps", err);
          setError(tx("mapLoadFailed"));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    initMap();

    return () => {
      active = false;
    };
  }, [apiKey, onLocationSelect, previewLang, tx]);

  useEffect(() => {
    if (
      typeof latitude === "number" &&
      typeof longitude === "number" &&
      mapRef.current &&
      window.google?.maps
    ) {
      const position = {
        lat: latitude,
        lng: longitude,
      };

      mapRef.current.setCenter(position);
      mapRef.current.setZoom(15);

      if (!markerRef.current) {
        markerRef.current = new window.google.maps.Marker({
          map: mapRef.current,
          position,
        });
      } else {
        markerRef.current.setPosition(position);
      }

      return;
    }

    if (!value?.trim() || !mapRef.current || !geocoderRef.current) {
      return;
    }

    let active = true;

    const syncAddressToMap = async () => {
      const position = await geocodeAddress(geocoderRef.current!, value.trim());

      if (!active || !position || !mapRef.current || !window.google?.maps) {
        return;
      }

      mapRef.current.setCenter(position);
      mapRef.current.setZoom(15);

      if (!markerRef.current) {
        markerRef.current = new window.google.maps.Marker({
          map: mapRef.current,
          position,
        });
      } else {
        markerRef.current.setPosition(position);
      }
    };

    syncAddressToMap();

    return () => {
      active = false;
    };
  }, [latitude, longitude, value]);

  return (
    <div className="filming-locations-map-picker">
      <div className="filming-locations-map-frame" ref={mapContainerRef} />
      {loading ? (
        <div className="filming-locations-map-status">
          {tx("mapLoading")}
        </div>
      ) : null}
      {error ? <div className="filming-locations-map-status is-error">{error}</div> : null}
      <div className="filming-locations-map-hint">
        {tx("mapHint")}
      </div>
    </div>
  );
};

export default GoogleMapPicker;
