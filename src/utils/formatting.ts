
/**
 * Safely converts any value to a string representation for display
 * Handles objects, arrays, nulls, and undefined values
 */
export const safeDisplayValue = (value: any): string => {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(item => safeDisplayValue(item)).join(', ');
    }
    // Convert objects to string representation
    return JSON.stringify(value);
  }
  
  return String(value);
};
