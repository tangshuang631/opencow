import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";
import { beforeEach } from "vitest";

configure({
  asyncUtilTimeout: 5000
});

beforeEach(() => {
  window.localStorage.clear();
});
