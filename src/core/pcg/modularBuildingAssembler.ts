import * as THREE from 'three';
import type { TaskCategory } from '../../types/focus';

export interface ModularPartPlacement {
  id: string;
  modelUrl: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: [number, number, number] | number;
}

export interface ModularAssemblyBlueprint {
  category: TaskCategory;
  groundRadius: number;
  stage0Stakes: ModularPartPlacement[];
  stage1Framing: ModularPartPlacement[];
  stage2UnderConstruction: ModularPartPlacement[];
  stage3Completed: ModularPartPlacement[];
}

/**
 * Procedural Modular Building Assembler for Project Oakvale.
 * Grounded in the Quaternius Medieval Village MegaKit:
 * Rather than treating buildings as monolithic static boxes, this engine dynamically
 * composes architecture from modular wall frames, corner pillars, doorways, roof gables,
 * and decorative trade props based on the building archetype and growth stage.
 */
export function getModularBlueprint(category: TaskCategory): ModularAssemblyBlueprint {
  switch (category) {
    case 'GUILD_WORKSHOP':
      return {
        category,
        groundRadius: 4.2,
        stage0Stakes: [
          {
            id: 'floor_foundation',
            modelUrl: '/assets/models/modular/Floor_WoodDark.gltf',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 1.2
          },
          {
            id: 'lumber_prop_0',
            modelUrl: '/assets/models/props/resource_lumber.gltf',
            position: [1.2, 0.05, 0.8],
            rotation: [0, 0.35, 0],
            scale: 0.95
          }
        ],
        stage1Framing: [
          {
            id: 'corner_ne',
            modelUrl: '/assets/models/modular/Corner_Exterior_Wood.gltf',
            position: [1.3, 0, 1.3],
            rotation: [0, 0, 0],
            scale: 1.15
          },
          {
            id: 'corner_nw',
            modelUrl: '/assets/models/modular/Corner_Exterior_Wood.gltf',
            position: [-1.3, 0, 1.3],
            rotation: [0, Math.PI * 0.5, 0],
            scale: 1.15
          },
          {
            id: 'scaffold_main',
            modelUrl: '/assets/models/buildings/building_scaffolding.gltf',
            position: [0, 0, -0.6],
            rotation: [0, 0, 0],
            scale: 0.9
          },
          {
            id: 'lumber_stack_1',
            modelUrl: '/assets/models/props/resource_lumber.gltf',
            position: [1.6, 0.05, -0.8],
            rotation: [0, 0.6, 0],
            scale: 1.1
          }
        ],
        stage2UnderConstruction: [
          {
            id: 'door_frame',
            modelUrl: '/assets/models/modular/DoorFrame_Flat_WoodDark.gltf',
            position: [0, 0, 1.35],
            rotation: [0, 0, 0],
            scale: 1.15
          },
          {
            id: 'corner_se',
            modelUrl: '/assets/models/modular/Corner_Exterior_Wood.gltf',
            position: [1.3, 0, -1.3],
            rotation: [0, -Math.PI * 0.5, 0],
            scale: 1.15
          },
          {
            id: 'corner_sw',
            modelUrl: '/assets/models/modular/Corner_Exterior_Wood.gltf',
            position: [-1.3, 0, -1.3],
            rotation: [0, Math.PI, 0],
            scale: 1.15
          },
          {
            id: 'barrel_cluster',
            modelUrl: '/assets/models/props/barrel.gltf',
            position: [-1.7, 0.05, 0.9],
            rotation: [0, 0.2, 0],
            scale: 0.9
          },
          {
            id: 'lumber_sawing',
            modelUrl: '/assets/models/props/resource_lumber.gltf',
            position: [0, 0.05, -1.8],
            rotation: [0, 1.2, 0],
            scale: 1.2
          }
        ],
        stage3Completed: [
          {
            id: 'completed_sawmill',
            modelUrl: '/assets/models/buildings/building_lumbermill_green.gltf',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 1.05
          },
          {
            id: 'decor_lumber',
            modelUrl: '/assets/models/props/resource_lumber.gltf',
            position: [2.1, 0.05, 1.2],
            rotation: [0, 0.4, 0],
            scale: 1.0
          },
          {
            id: 'decor_crates',
            modelUrl: '/assets/models/props/crate_A_big.gltf',
            position: [-2.0, 0.05, 1.4],
            rotation: [0, 0.75, 0],
            scale: 0.85
          }
        ]
      };

    case 'SCHOLAR_TOWER':
      return {
        category,
        groundRadius: 3.8,
        stage0Stakes: [
          {
            id: 'floor_stone',
            modelUrl: '/assets/models/modular/Floor_Brick.gltf',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 1.2
          },
          {
            id: 'stone_pile_0',
            modelUrl: '/assets/models/props/resource_stone.gltf',
            position: [1.1, 0.05, 1.0],
            rotation: [0, 0.2, 0],
            scale: 0.9
          }
        ],
        stage1Framing: [
          {
            id: 'corner_stone_1',
            modelUrl: '/assets/models/modular/Corner_Exterior_Brick.gltf',
            position: [1.2, 0, 1.2],
            rotation: [0, 0, 0],
            scale: 1.2
          },
          {
            id: 'corner_stone_2',
            modelUrl: '/assets/models/modular/Corner_Exterior_Brick.gltf',
            position: [-1.2, 0, 1.2],
            rotation: [0, Math.PI * 0.5, 0],
            scale: 1.2
          },
          {
            id: 'scaffolding_tower',
            modelUrl: '/assets/models/buildings/building_scaffolding.gltf',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 1.1
          }
        ],
        stage2UnderConstruction: [
          {
            id: 'door_round_stone',
            modelUrl: '/assets/models/modular/DoorFrame_Round_Brick.gltf',
            position: [0, 0, 1.3],
            rotation: [0, 0, 0],
            scale: 1.2
          },
          {
            id: 'balcony_arch',
            modelUrl: '/assets/models/modular/Balcony_Cross_Straight.gltf',
            position: [0, 2.4, 1.3],
            rotation: [0, 0, 0],
            scale: 1.05
          },
          {
            id: 'stone_prop_stack',
            modelUrl: '/assets/models/props/resource_stone.gltf',
            position: [-1.6, 0.05, 1.1],
            rotation: [0, 0.5, 0],
            scale: 1.1
          }
        ],
        stage3Completed: [
          {
            id: 'completed_scriptorium',
            modelUrl: '/assets/models/buildings/building_church_green.gltf',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 1.0
          },
          {
            id: 'decor_bench',
            modelUrl: '/assets/models/props/chair_A_wood.gltf',
            position: [1.8, 0.05, 1.3],
            rotation: [0, -0.4, 0],
            scale: 0.95
          }
        ]
      };

    case 'MARKET_HEARTH':
      return {
        category,
        groundRadius: 4.0,
        stage0Stakes: [
          {
            id: 'floor_uneven',
            modelUrl: '/assets/models/modular/Floor_UnevenBrick.gltf',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 1.25
          }
        ],
        stage1Framing: [
          {
            id: 'scaffold_market',
            modelUrl: '/assets/models/buildings/building_scaffolding.gltf',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 0.95
          },
          {
            id: 'crate_prop_1',
            modelUrl: '/assets/models/props/crate_A_big.gltf',
            position: [1.3, 0.05, 0.8],
            rotation: [0, 0.3, 0],
            scale: 1.0
          }
        ],
        stage2UnderConstruction: [
          {
            id: 'door_market_frame',
            modelUrl: '/assets/models/modular/DoorFrame_Flat_WoodDark.gltf',
            position: [0, 0, 1.2],
            rotation: [0, 0, 0],
            scale: 1.15
          },
          {
            id: 'barrel_market',
            modelUrl: '/assets/models/props/barrel.gltf',
            position: [-1.4, 0.05, 0.9],
            rotation: [0, 0, 0],
            scale: 1.0
          }
        ],
        stage3Completed: [
          {
            id: 'completed_market_square',
            modelUrl: '/assets/models/buildings/building_market_green.gltf',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 1.05
          },
          {
            id: 'decor_crates',
            modelUrl: '/assets/models/props/crate_A_big.gltf',
            position: [1.8, 0.05, 1.2],
            rotation: [0, 0.6, 0],
            scale: 0.9
          }
        ]
      };

    case 'MILL_GRANARY':
      return {
        category,
        groundRadius: 3.8,
        stage0Stakes: [
          {
            id: 'floor_mill',
            modelUrl: '/assets/models/modular/Floor_Brick.gltf',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 1.15
          }
        ],
        stage1Framing: [
          {
            id: 'scaffold_mill',
            modelUrl: '/assets/models/buildings/building_scaffolding.gltf',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 1.0
          }
        ],
        stage2UnderConstruction: [
          {
            id: 'corner_mill_1',
            modelUrl: '/assets/models/modular/Corner_Exterior_Brick.gltf',
            position: [1.1, 0, 1.1],
            rotation: [0, 0, 0],
            scale: 1.15
          },
          {
            id: 'barrel_flour',
            modelUrl: '/assets/models/props/barrel.gltf',
            position: [-1.2, 0.05, 1.0],
            rotation: [0, 0, 0],
            scale: 0.95
          }
        ],
        stage3Completed: [
          {
            id: 'completed_windmill',
            modelUrl: '/assets/models/buildings/building_windmill_green.gltf',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 1.0
          }
        ]
      };

    case 'APOTHECARY_COTTAGE':
      return {
        category,
        groundRadius: 3.8,
        stage0Stakes: [
          {
            id: 'floor_forge',
            modelUrl: '/assets/models/modular/Floor_RedBrick.gltf',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 1.15
          }
        ],
        stage1Framing: [
          {
            id: 'scaffold_forge',
            modelUrl: '/assets/models/buildings/building_scaffolding.gltf',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 0.95
          }
        ],
        stage2UnderConstruction: [
          {
            id: 'door_forge',
            modelUrl: '/assets/models/modular/DoorFrame_Flat_Brick.gltf',
            position: [0, 0, 1.2],
            rotation: [0, 0, 0],
            scale: 1.15
          },
          {
            id: 'anvil_stone',
            modelUrl: '/assets/models/props/resource_stone.gltf',
            position: [1.3, 0.05, 0.8],
            rotation: [0, 0.4, 0],
            scale: 0.9
          }
        ],
        stage3Completed: [
          {
            id: 'completed_blacksmith',
            modelUrl: '/assets/models/buildings/building_blacksmith_green.gltf',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 1.05
          }
        ]
      };

    case 'MEADOW_PAVILION':
    default:
      return {
        category,
        groundRadius: 4.2,
        stage0Stakes: [
          {
            id: 'floor_tavern',
            modelUrl: '/assets/models/modular/Floor_WoodDark.gltf',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 1.2
          }
        ],
        stage1Framing: [
          {
            id: 'corner_t1',
            modelUrl: '/assets/models/modular/Corner_Exterior_Wood.gltf',
            position: [1.2, 0, 1.2],
            rotation: [0, 0, 0],
            scale: 1.15
          },
          {
            id: 'scaffold_t',
            modelUrl: '/assets/models/buildings/building_scaffolding.gltf',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 0.95
          }
        ],
        stage2UnderConstruction: [
          {
            id: 'door_tavern',
            modelUrl: '/assets/models/modular/DoorFrame_Flat_WoodDark.gltf',
            position: [0, 0, 1.25],
            rotation: [0, 0, 0],
            scale: 1.15
          },
          {
            id: 'barrel_tavern',
            modelUrl: '/assets/models/props/barrel.gltf',
            position: [-1.4, 0.05, 1.0],
            rotation: [0, 0.2, 0],
            scale: 1.0
          }
        ],
        stage3Completed: [
          {
            id: 'completed_tavern',
            modelUrl: '/assets/models/buildings/building_tavern_green.gltf',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 1.05
          },
          {
            id: 'decor_bench',
            modelUrl: '/assets/models/props/chair_B_wood.gltf',
            position: [1.7, 0.05, 1.1],
            rotation: [0, -0.6, 0],
            scale: 1.0
          }
        ]
      };
  }
}
