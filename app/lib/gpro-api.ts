// app/lib/gpro-api.ts

export const endpoints = [
  "Menu", "Office", "Staff", "Facilities", "Profile",
  "DriverProfile", "DriProfile", "CarProfile", "TrackProfile",
  "Tyres", "TyreTest", "TyresHistory", "Market", "MarketBids",
  "Training", "Testing", "TestFacility", "TestCar", "TestTrack",
  "Practice", "Qualify1", "Qualify2", "Race", "RaceAnalysis",
  "RaceReplay", "RaceSummary", "RaceHistory", "Championship",
  "Champs", "Standings", "Season", "Calendar", "Weather",
  "WeatherHistory", "Team", "TeamProfile", "TeamMembers",
  "TeamHistory", "TeamMessage", "Sponsors", "SponsorHistory",
  "Finance", "Supporter", "SupporterStats", "Help", "Tutorial",
  "Privacy", "Terms", "Settings", "Notifications", "Friends",
  "Messages", "Mail", "Chat", "Forum", "Wiki", "Stats",
  "Records", "HallOfFame", "Nations", "Track", "TrackRecords",
  "TrackStats", "Driver", "DriverStats", "Car", "CarStats"
];

export async function exploreGproEndpoint(
  endpoint: string, 
  params?: Record<string, string>,
  userId?: string
): Promise<any> {
  if (!userId) {
    throw new Error('Usuário não autenticado');
  }

  const response = await fetch('/api/gpro-kb/explore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, endpoint, params }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Erro ${response.status}`);
  }

  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'Erro desconhecido');
  return result.data;
}