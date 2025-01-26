// geoUtils.js

// 将角度转换为弧度
export function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

// 使用 Haversine 公式计算两个坐标之间的距离
export function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 地球半径，单位：公里

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // 最终距离，单位：公里
    return distance;
}

// 判断两个坐标是否在给定阈值范围内邻近
export function areCoordinatesNear(lat1, lon1, lat2, lon2, threshold) {
    const distance = haversineDistance(lat1, lon1, lat2, lon2);
    return distance <= threshold;
}