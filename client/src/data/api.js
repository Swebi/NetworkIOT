// API layer - swap USE_MOCK to false when backend is ready
import * as mockApi from "./mockApi";

const USE_MOCK = true;

export const getLiveData = () =>
  USE_MOCK
    ? Promise.resolve(mockApi.getLiveData())
    : fetch("/api/live").then((r) => r.json());

export const getPeakHours = () =>
  USE_MOCK
    ? Promise.resolve(mockApi.getPeakHours())
    : fetch("/api/historical/peak-hours").then((r) => r.json());

export const getWeeklyPatterns = () =>
  USE_MOCK
    ? Promise.resolve(mockApi.getWeeklyPatterns())
    : fetch("/api/historical/weekly").then((r) => r.json());

export const getUnderusedSpaces = () =>
  USE_MOCK
    ? Promise.resolve(mockApi.getUnderusedSpaces())
    : fetch("/api/historical/underused").then((r) => r.json());

export const getPredictions = () =>
  USE_MOCK
    ? Promise.resolve(mockApi.getPredictions())
    : fetch("/api/predictions").then((r) => r.json());

export const getOvercrowdingAlerts = () =>
  USE_MOCK
    ? Promise.resolve(mockApi.getOvercrowdingAlerts())
    : fetch("/api/alerts").then((r) => r.json());

export const getSystemStatus = () =>
  USE_MOCK
    ? Promise.resolve(mockApi.getSystemStatus())
    : fetch("/api/status").then((r) => r.json());
