export interface EconomyBuildingNode {
  id: string;
  name: string;
  roleTitle: string;
  workerName: string;
  speakerId: 'ELENA_VILLAGER' | 'MAYA_BUILDER' | 'ROWAN_ELDER';
  xPercent: number;
  yPercent: number;
  productionLabel: string;
  voiceGreeting: string;
  buildingStyle: 'SAWMILL' | 'FORGE' | 'BAKERY' | 'CONSTABLE' | 'TOWN_HALL';
}

export interface AutonomousCitizenAgent {
  id: string;
  name: string;
  job: string;
  outfitColor: string;
  hairColor: string;
  carryingItem: 'TIMBER' | 'BREAD' | 'TOOLS' | 'GOLD' | 'LANTERN';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  speed: number;
  phaseOffset: number;
  statusBubble: string;
}

export const VILLAGE_ECONOMY_BUILDINGS: EconomyBuildingNode[] = [
  {
    id: 'econ-townhall',
    name: 'Oakvale Grand Keep',
    roleTitle: 'Town Hall & Treasury',
    workerName: 'Elena (Village Steward)',
    speakerId: 'ELENA_VILLAGER',
    xPercent: 49,
    yPercent: 46,
    productionLabel: 'Coordinates Builders & Town Treasury',
    voiceGreeting:
      'Welcome to the Grand Keep! Every goal you complete expands our village treasury and unlocks new artisan workshops.',
    buildingStyle: 'TOWN_HALL'
  },
  {
    id: 'econ-sawmill',
    name: 'Riverbend Timber Mill',
    roleTitle: 'Woodcutters & Carpentry',
    workerName: 'Garrick (Master Sawyer)',
    speakerId: 'ROWAN_ELDER',
    xPercent: 23,
    yPercent: 38,
    productionLabel: '+15 Oak Timber / cycle',
    voiceGreeting:
      'Our woodcutters are felling oak and milling fresh beams for your next goal building!',
    buildingStyle: 'SAWMILL'
  },
  {
    id: 'econ-forge',
    name: 'Emberstone Blacksmith',
    roleTitle: 'Ironworks & Builder Tools',
    workerName: 'Tormund (Master Smith)',
    speakerId: 'ROWAN_ELDER',
    xPercent: 75,
    yPercent: 39,
    productionLabel: '+10 Iron Tools / cycle',
    voiceGreeting:
      'The forge is roaring hot! We have nails, hinges, and mason tools ready for your construction crew.',
    buildingStyle: 'FORGE'
  },
  {
    id: 'econ-bakery',
    name: 'Hearthstone Bakery & Market',
    roleTitle: 'Village Shop & Provisions',
    workerName: 'Clara (Master Baker)',
    speakerId: 'MAYA_BUILDER',
    xPercent: 54,
    yPercent: 66,
    productionLabel: '+25 Gold & Warm Bread / cycle',
    voiceGreeting:
      'Fresh loaves just came out of the brick oven! The villagers are well-fed and excited to see you succeed today.',
    buildingStyle: 'BAKERY'
  },
  {
    id: 'econ-constable',
    name: 'Town Watch & Constable Station',
    roleTitle: 'Village Safety & Order',
    workerName: 'Captain Vance',
    speakerId: 'ROWAN_ELDER',
    xPercent: 81,
    yPercent: 63,
    productionLabel: '100% Town Peace & Safety',
    voiceGreeting:
      'All roads and storehouses are safe and secure! Focus on your work—we are watching over the town.',
    buildingStyle: 'CONSTABLE'
  }
];

export const AUTONOMOUS_CITIZEN_AGENTS: AutonomousCitizenAgent[] = [
  {
    id: 'cit-1',
    name: 'Garrick',
    job: 'Woodcutter',
    outfitColor: '#3B6E4C',
    hairColor: '#5C3A21',
    carryingItem: 'TIMBER',
    fromX: 23,
    fromY: 38,
    toX: 37,
    toY: 48,
    speed: 0.22,
    phaseOffset: 0.0,
    statusBubble: 'Hauling oak beams to site'
  },
  {
    id: 'cit-2',
    name: 'Clara',
    job: 'Baker',
    outfitColor: '#C85232',
    hairColor: '#3A2010',
    carryingItem: 'BREAD',
    fromX: 54,
    fromY: 66,
    toX: 49,
    toY: 46,
    speed: 0.26,
    phaseOffset: 1.4,
    statusBubble: 'Delivering warm bread to market'
  },
  {
    id: 'cit-3',
    name: 'Tormund',
    job: 'Blacksmith',
    outfitColor: '#4A5568',
    hairColor: '#B45309',
    carryingItem: 'TOOLS',
    fromX: 75,
    fromY: 39,
    toX: 62,
    toY: 46,
    speed: 0.2,
    phaseOffset: 2.7,
    statusBubble: 'Carrying forged iron tools'
  },
  {
    id: 'cit-4',
    name: 'Captain Vance',
    job: 'Town Constable',
    outfitColor: '#1E3A8A',
    hairColor: '#2D3748',
    carryingItem: 'LANTERN',
    fromX: 81,
    fromY: 63,
    toX: 54,
    toY: 66,
    speed: 0.18,
    phaseOffset: 3.9,
    statusBubble: 'Patrolling market square'
  },
  {
    id: 'cit-5',
    name: 'Maya',
    job: 'Master Builder',
    outfitColor: '#D97706',
    hairColor: '#7C2D12',
    carryingItem: 'GOLD',
    fromX: 49,
    fromY: 46,
    toX: 35,
    toY: 65,
    speed: 0.25,
    phaseOffset: 5.1,
    statusBubble: 'Inspecting construction blueprints'
  }
];
