export const formatImageDataUrl = (base64: string, mimeType: string = 'image/png'): string => {
  if (base64.startsWith('data:')) {
    return base64;
  }
  return `data:${mimeType};base64,${base64}`;
};

export const getRiskColor = (risk: string): string => {
  switch (risk) {
    case 'bajo':
      return 'text-green-600 dark:text-green-400';
    case 'medio':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'alto':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
};

export const getRiskIcon = (risk: string): string => {
  switch (risk) {
    case 'bajo':
      return '🟢';
    case 'medio':
      return '🟡';
    case 'alto':
      return '🔴';
    default:
      return '⚪';
  }
};

export const getHealthColor = (health: number): string => {
  if (health >= 80) return 'text-green-600 dark:text-green-400';
  if (health >= 60) return 'text-yellow-600 dark:text-yellow-400';
  if (health >= 40) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
};