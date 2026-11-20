import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, LocateFixed, MapPin, Search, X } from 'lucide-react';
import { useAppState } from '../../state/AppStateContext';
import type { LocationOption } from '../../types/breathewise';

export function LocationSelector() {
  const {
    location,
    setLocation,
    availableLocations,
    airLivePlaces,
    placesLoading,
    placesError,
    refreshPlaces,
    selectLocationByCoordinates,
  } = useAppState();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const restoreFocusOnCloseRef = useRef(false);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        restoreFocusOnCloseRef.current = false;
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        restoreFocusOnCloseRef.current = true;
        setOpen(false);
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last || !dialogRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    } else {
      setQuery('');
      setGeoError(null);
      if (wasOpenRef.current && restoreFocusOnCloseRef.current) {
        triggerRef.current?.focus();
      }
      restoreFocusOnCloseRef.current = false;
      wasOpenRef.current = false;
    }
  }, [open]);

  const placeMetricsBySlug = useMemo(() => {
    const map = new Map<string, { usAqi: number | null; source: string }>();
    for (const p of airLivePlaces) {
      map.set(p.slug, { usAqi: p.usAqi, source: p.source });
    }
    return map;
  }, [airLivePlaces]);

  const filteredLocations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return availableLocations.slice(0, 60);
    }
    return availableLocations
      .filter(
        (loc) =>
          loc.name.toLowerCase().includes(needle) ||
          loc.slug.toLowerCase().includes(needle) ||
          (loc.countryName ?? loc.state).toLowerCase().includes(needle),
      )
      .slice(0, 60);
  }, [availableLocations, query]);

  const handleSelect = (loc: LocationOption) => {
    setLocation(loc);
    setGeoError(null);
    restoreFocusOnCloseRef.current = true;
    setOpen(false);
  };

  const handleUseDeviceLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Browser geolocation is unavailable in this environment. Search manually instead.');
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await selectLocationByCoordinates(pos.coords.latitude, pos.coords.longitude);
          restoreFocusOnCloseRef.current = true;
          setOpen(false);
        } catch (err) {
          setGeoError(
            err instanceof Error
              ? err.message
              : 'No supported AirLive station within 200 km of your coordinates.',
          );
        } finally {
          setGeoLoading(false);
        }
      },
      () => {
        setGeoLoading(false);
        setGeoError('Location permission denied or timed out. Use manual search below.');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Select monitoring location"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-md px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm font-medium text-slate-800 cursor-pointer max-w-[128px] sm:max-w-[260px]"
      >
        <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-700 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {location.name}
          {location.countryName ? `, ${location.countryName}` : ''}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Search AirLive Indian locations"
          className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[92vw] bg-white border border-slate-200 rounded-lg shadow-md z-50"
        >
          <div className="p-2.5 border-b border-slate-200 space-y-2">
            <div className="relative flex items-center">
              <Search
                className="w-4 h-4 text-slate-500 absolute left-2.5 pointer-events-none"
                aria-hidden="true"
              />
              <label htmlFor="header-location-search" className="sr-only">
                Search Indian locations
              </label>
              <input
                ref={searchInputRef}
                id="header-location-search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Indian cities & localities..."
                className="w-full pl-8 pr-9 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-md placeholder:text-slate-500 focus:outline-none focus:border-teal-700"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear location search"
                  onClick={() => {
                    setQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-1.5 min-w-6 min-h-6 flex items-center justify-center rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 px-0.5">
              <span>
                {placesLoading
                  ? 'Loading AirLive India locations...'
                  : `${airLivePlaces.length || availableLocations.length} Indian locations via AirLive`}
              </span>
              <div className="flex items-center gap-2">
                {placesError && (
                  <button
                    type="button"
                    onClick={refreshPlaces}
                    className="min-h-6 inline-flex items-center px-1 text-teal-800 font-medium hover:underline cursor-pointer"
                  >
                    Retry list
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleUseDeviceLocation}
                  disabled={geoLoading}
                  className="min-h-6 inline-flex items-center gap-1 px-1 text-teal-800 font-medium hover:underline cursor-pointer disabled:opacity-50"
                >
                  <LocateFixed className="w-3 h-3" aria-hidden="true" />
                  <span>{geoLoading ? 'Locating...' : 'Use device location'}</span>
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-600 px-0.5">
              Browser geolocation is optional and used only on click to match the nearest station.
            </p>
            {geoError && (
              <p className="text-[11px] text-red-700 px-0.5" role="alert">
                {geoError}
              </p>
            )}
          </div>

          <ul
            role="listbox"
            aria-label="Supported Indian locations"
            className="max-h-72 overflow-y-auto divide-y divide-slate-100"
          >
            {filteredLocations.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-slate-600">
                No matching supported AirLive locations found for &ldquo;{query}&rdquo;.
              </li>
            ) : (
              filteredLocations.map((loc) => {
                const isSelected = loc.slug === location.slug;
                const meta = placeMetricsBySlug.get(loc.slug);
                return (
                  <li key={loc.slug}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(loc)}
                      className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left text-xs sm:text-sm cursor-pointer transition-colors ${
                        isSelected ? 'bg-teal-50 text-teal-900 font-semibold' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate">
                          {loc.name}{' '}
                          <span className="text-slate-600 font-normal">
                            · {loc.countryName || loc.state || 'India'}
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-600 font-mono truncate">
                          {loc.kind ?? 'city'} · {loc.slug}
                        </p>
                      </div>
                      {meta && meta.usAqi !== null && (
                        <span className="shrink-0 font-mono text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-800">
                          US AQI {meta.usAqi}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
