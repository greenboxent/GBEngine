/**
 * A* pathfinding for maze/grid navigation.
 * @module systems/Pathfinding
 */

/**
 * Find a path from start to goal using A* algorithm
 * @param {number[][]} grid - 2D array where 0 = walkable, 1 = wall
 * @param {number} startX - Start grid X
 * @param {number} startY - Start grid Y  
 * @param {number} goalX - Goal grid X
 * @param {number} goalY - Goal grid Y
 * @returns {Array<{x: number, y: number}>} - Array of grid positions or empty if no path
 */
export function findPath(grid, startX, startY, goalX, goalY) {
    const rows = grid.length;
    const cols = grid[0].length;
    
    // Bounds check
    if (startX < 0 || startX >= cols || startY < 0 || startY >= rows) return [];
    if (goalX < 0 || goalX >= cols || goalY < 0 || goalY >= rows) return [];
    if (grid[startY][startX] === 1 || grid[goalY][goalX] === 1) return [];
    
    // If already at goal
    if (startX === goalX && startY === goalY) return [{x: startX, y: startY}];
    
    // A* implementation
    const openSet = [{x: startX, y: startY, g: 0, h: heuristic(startX, startY, goalX, goalY), f: 0}];
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    
    const key = (x, y) => `${x},${y}`;
    gScore.set(key(startX, startY), 0);
    openSet[0].f = openSet[0].h;
    
    while (openSet.length > 0) {
        // Find node with lowest f score
        openSet.sort((a, b) => a.f - b.f);
        const current = openSet.shift();
        
        // Goal reached
        if (current.x === goalX && current.y === goalY) {
            return reconstructPath(cameFrom, current);
        }
        
        closedSet.add(key(current.x, current.y));
        
        // Check neighbors (4-directional)
        const neighbors = [
            {x: current.x + 1, y: current.y},
            {x: current.x - 1, y: current.y},
            {x: current.x, y: current.y + 1},
            {x: current.x, y: current.y - 1}
        ];
        
        for (const neighbor of neighbors) {
            const {x, y} = neighbor;
            
            // Skip if out of bounds or wall
            if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
            if (grid[y][x] === 1) continue;
            
            const neighborKey = key(x, y);
            if (closedSet.has(neighborKey)) continue;
            
            const tentativeG = gScore.get(key(current.x, current.y)) + 1;
            
            if (!gScore.has(neighborKey) || tentativeG < gScore.get(neighborKey)) {
                cameFrom.set(neighborKey, {x: current.x, y: current.y});
                gScore.set(neighborKey, tentativeG);
                
                const h = heuristic(x, y, goalX, goalY);
                const f = tentativeG + h;
                
                // Add to open set if not already there
                if (!openSet.some(node => node.x === x && node.y === y)) {
                    openSet.push({x, y, g: tentativeG, h, f});
                }
            }
        }
    }
    
    // No path found
    return [];
}

/**
 * Manhattan distance heuristic for A*.
 * @param {number} x1  X coordinate of the start node.
 * @param {number} y1  Y coordinate of the start node.
 * @param {number} x2  X coordinate of the goal node.
 * @param {number} y2  Y coordinate of the goal node.
 * @returns {number}
 */
function heuristic(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

/**
 * Reconstructs the path from start to goal by following the `cameFrom` map.
 * @param {Map<string, {x:number,y:number}>} cameFrom
 * @param {{x:number,y:number}} current - The goal node.
 * @returns {Array<{x:number,y:number}>}
 */
function reconstructPath(cameFrom, current) {
    const path = [{x: current.x, y: current.y}];
    const key = (x, y) => `${x},${y}`;
    
    let currentKey = key(current.x, current.y);
    while (cameFrom.has(currentKey)) {
        const prev = cameFrom.get(currentKey);
        path.unshift({x: prev.x, y: prev.y});
        currentKey = key(prev.x, prev.y);
    }
    
    return path;
}

/**
 * Convert world position to grid position
 */
export function worldToGrid(worldX, worldY, tileSize = 64) {
    return {
        x: Math.floor(worldX / tileSize),
        y: Math.floor(worldY / tileSize)
    };
}

/**
 * Convert grid position to world position (center of tile)
 */
export function gridToWorld(gridX, gridY, tileSize = 64) {
    return {
        x: gridX * tileSize + tileSize / 2,
        y: gridY * tileSize + tileSize / 2
    };
}
