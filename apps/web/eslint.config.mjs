import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import base from "../../eslint.config.mjs";

const config = [...base, ...nextVitals, ...nextTs];

export default config;
