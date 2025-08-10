export const UNIVERSITIES = [
  "University of Colombo",
  "University of Peradeniya",
  "University of Moratuwa",
  "University of Sri Jayewardenepura",
  "University of Kelaniya",
  "University of Ruhuna",
  "Open University of Sri Lanka",
  "SLIIT",
  "NSBM Green University",
  "Informatics Institute of Technology (IIT)",
  "Sri Lanka Technological Campus (SLTC)",
  "General Sir John Kotelawala Defence University (KDU)"
];

export function norm(s = "") {
  return String(s).trim().toLowerCase();
}

export function overlap(a = [], b = []) {
  const A = new Set(a.map(norm));
  for (const item of b) if (A.has(norm(item))) return true;
  return false;
}