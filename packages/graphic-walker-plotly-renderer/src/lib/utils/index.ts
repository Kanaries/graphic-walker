export const formatName = (name: string): string => {
  return name.trim().charAt(0).toUpperCase() + name.slice(1);
};

export const getGreeting = (hour: number): string => {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};