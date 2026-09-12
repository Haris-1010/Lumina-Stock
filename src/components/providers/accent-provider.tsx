"use client";

import { useEffect } from "react";

// RGB channel values for each accent theme (used as CSS custom properties)
const ACCENT_VARS: Record<string, Record<string, string>> = {
  emerald: {
    "--accent-50":  "236 253 245",
    "--accent-100": "209 250 229",
    "--accent-200": "167 243 208",
    "--accent-300": "110 231 183",
    "--accent-400": "52 211 153",
    "--accent-500": "16 185 129",
    "--accent-600": "5 150 105",
    "--accent-700": "4 120 87",
    "--accent-800": "6 95 70",
    "--accent-900": "6 78 59",
    "--accent-950": "2 44 34",
  },
  sky: {
    "--accent-50":  "240 249 255",
    "--accent-100": "224 242 254",
    "--accent-200": "186 230 253",
    "--accent-300": "125 211 252",
    "--accent-400": "56 189 248",
    "--accent-500": "14 165 233",
    "--accent-600": "2 132 199",
    "--accent-700": "3 105 161",
    "--accent-800": "7 89 133",
    "--accent-900": "12 74 110",
    "--accent-950": "8 47 73",
  },
  violet: {
    "--accent-50":  "245 243 255",
    "--accent-100": "237 233 254",
    "--accent-200": "221 214 254",
    "--accent-300": "196 181 253",
    "--accent-400": "167 139 250",
    "--accent-500": "139 92 246",
    "--accent-600": "124 58 237",
    "--accent-700": "109 40 217",
    "--accent-800": "91 33 182",
    "--accent-900": "76 29 149",
    "--accent-950": "46 16 101",
  },
  rose: {
    "--accent-50":  "255 241 242",
    "--accent-100": "255 228 230",
    "--accent-200": "254 205 211",
    "--accent-300": "253 164 175",
    "--accent-400": "251 113 133",
    "--accent-500": "244 63 94",
    "--accent-600": "225 29 72",
    "--accent-700": "190 18 60",
    "--accent-800": "159 18 57",
    "--accent-900": "136 19 55",
    "--accent-950": "76 5 25",
  },
  amber: {
    "--accent-50":  "255 251 235",
    "--accent-100": "254 243 199",
    "--accent-200": "253 230 138",
    "--accent-300": "252 211 77",
    "--accent-400": "251 191 36",
    "--accent-500": "245 158 11",
    "--accent-600": "217 119 6",
    "--accent-700": "180 83 9",
    "--accent-800": "146 64 14",
    "--accent-900": "120 53 15",
    "--accent-950": "69 26 3",
  },
  zinc: {
    "--accent-50":  "250 250 250",
    "--accent-100": "244 244 245",
    "--accent-200": "228 228 231",
    "--accent-300": "212 212 216",
    "--accent-400": "161 161 170",
    "--accent-500": "113 113 122",
    "--accent-600": "82 82 91",
    "--accent-700": "63 63 70",
    "--accent-800": "39 39 42",
    "--accent-900": "24 24 27",
    "--accent-950": "9 9 11",
  },
};

interface Props {
  colorAccent: string;
}

export function AccentApplier({ colorAccent }: Props) {
  useEffect(() => {
    const vars = ACCENT_VARS[colorAccent] ?? ACCENT_VARS.emerald;
    const root = document.documentElement;
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    root.dataset.accent = colorAccent;
  }, [colorAccent]);

  return null;
}
