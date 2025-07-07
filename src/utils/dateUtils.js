/**
 * Date Utilities - Ensures all dates are consistent with system local time
 * This module provides standardized date handling for the entire application
 */

/**
 * Get current system date in YYYY-MM-DD format
 * @returns {string} Date string in YYYY-MM-DD format
 */
function getLocalDateString() {
  const today = new Date();
  return formatDateToYMD(today);
}

/**
 * Get current system date and time in YYYY-MM-DD HH:mm:ss format
 * @returns {string} DateTime string in YYYY-MM-DD HH:mm:ss format
 */
function getLocalDateTimeString() {
  const now = new Date();
  return formatDateTimeToString(now);
}

/**
 * Format a Date object to YYYY-MM-DD string
 * @param {Date} date - Date object to format
 * @returns {string} Date string in YYYY-MM-DD format
 */
function formatDateToYMD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format a Date object to YYYY-MM-DD HH:mm:ss string
 * @param {Date} date - Date object to format
 * @returns {string} DateTime string in YYYY-MM-DD HH:mm:ss format
 */
function formatDateTimeToString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Parse date string (YYYY-MM-DD HH:mm:ss or YYYY-MM-DD) as local time
 * @param {string} dateString - Date string to parse
 * @returns {Date|null} Date object or null if invalid
 */
function parseLocalDateString(dateString) {
  if (!dateString || typeof dateString !== "string") return null;
  
  const [datePart, timePart] = dateString.split(" ");
  if (!datePart) return null;
  
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return null;
  
  if (timePart) {
    const [hour, min, sec] = timePart.split(":").map(Number);
    return new Date(year, month - 1, day, hour || 0, min || 0, sec || 0);
  } else {
    return new Date(year, month - 1, day);
  }
}

/**
 * Format date string to DD/MM/YYYY format for display
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} Date string in DD/MM/YYYY format
 */
function formatDateForDisplay(dateString) {
  const date = parseLocalDateString(dateString);
  if (!date) return "-";
  
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}

/**
 * Get start of day for a given date (00:00:00)
 * @param {Date|string} date - Date object or date string
 * @returns {string} DateTime string for start of day
 */
function getStartOfDay(date) {
  let targetDate;
  if (typeof date === "string") {
    targetDate = parseLocalDateString(date);
  } else {
    targetDate = new Date(date);
  }
  
  if (!targetDate) return null;
  
  const startOfDay = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    0, 0, 0
  );
  
  return formatDateTimeToString(startOfDay);
}

/**
 * Get end of day for a given date (23:59:59)
 * @param {Date|string} date - Date object or date string
 * @returns {string} DateTime string for end of day
 */
function getEndOfDay(date) {
  let targetDate;
  if (typeof date === "string") {
    targetDate = parseLocalDateString(date);
  } else {
    targetDate = new Date(date);
  }
  
  if (!targetDate) return null;
  
  const endOfDay = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    23, 59, 59
  );
  
  return formatDateTimeToString(endOfDay);
}

/**
 * Get previous day date string
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} Previous day date string in YYYY-MM-DD format
 */
function getPreviousDay(dateString) {
  const date = parseLocalDateString(dateString);
  if (!date) return null;
  
  const previousDay = new Date(date);
  previousDay.setDate(previousDay.getDate() - 1);
  
  return formatDateToYMD(previousDay);
}

/**
 * Format time from Date object to HH:mm:ss format
 * @param {Date} date - Date object
 * @returns {string} Time string in HH:mm:ss format
 */
function formatTimeString(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Get current system time in HH:mm:ss format
 * @returns {string} Current time in HH:mm:ss format
 */
function getCurrentTimeString() {
  return formatTimeString(new Date());
}

/**
 * Create date range object for queries
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {object} Object with start and end datetime strings
 */
function createDateRange(startDate, endDate) {
  return {
    start: getStartOfDay(startDate),
    end: getEndOfDay(endDate)
  };
}

module.exports = {
  getLocalDateString,
  getLocalDateTimeString,
  formatDateToYMD,
  formatDateTimeToString,
  parseLocalDateString,
  formatDateForDisplay,
  getStartOfDay,
  getEndOfDay,
  getPreviousDay,
  formatTimeString,
  getCurrentTimeString,
  createDateRange
};
