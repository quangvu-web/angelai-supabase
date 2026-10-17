import fireSpark from "./pets/fire-spark.png";
import fireGlow from "./pets/fire-glow.png";
import fireFlame from "./pets/fire-flame.png";
import fireStar from "./pets/fire-star.png";
import fireSun from "./pets/fire-sun.png";
import fireCosmos from "./pets/fire-cosmos.png";
import waterSpark from "./pets/water-spark.png";
import waterGlow from "./pets/water-glow.png";
import waterFlame from "./pets/water-flame.png";
import waterStar from "./pets/water-star.png";
import waterSun from "./pets/water-sun.png";
import waterCosmos from "./pets/water-cosmos.png";
import earthSpark from "./pets/earth-spark.png";
import earthGlow from "./pets/earth-glow.png";
import earthFlame from "./pets/earth-flame.png";
import earthStar from "./pets/earth-star.png";
import earthSun from "./pets/earth-sun.png";
import earthCosmos from "./pets/earth-cosmos.png";
import airSpark from "./pets/air-spark.png";
import airGlow from "./pets/air-glow.png";
import airFlame from "./pets/air-flame.png";
import airStar from "./pets/air-star.png";
import airSun from "./pets/air-sun.png";
import airCosmos from "./pets/air-cosmos.png";
import lightSpark from "./pets/light-spark.png";
import lightGlow from "./pets/light-glow.png";
import lightFlame from "./pets/light-flame.png";
import lightStar from "./pets/light-star.png";
import lightSun from "./pets/light-sun.png";
import lightCosmos from "./pets/light-cosmos.png";
import type { PetElement, PetEvolution } from "@/hooks/usePet";

export const PET_EVOLUTION_ORDER: PetEvolution[] = ["spark", "glow", "flame", "star", "sun", "cosmos"];

export const PET_IMAGES: Record<PetElement, Record<PetEvolution, string>> = {
  fire: {
    spark: fireSpark,
    glow: fireGlow,
    flame: fireFlame,
    star: fireStar,
    sun: fireSun,
    cosmos: fireCosmos,
  },
  water: {
    spark: waterSpark,
    glow: waterGlow,
    flame: waterFlame,
    star: waterStar,
    sun: waterSun,
    cosmos: waterCosmos,
  },
  earth: {
    spark: earthSpark,
    glow: earthGlow,
    flame: earthFlame,
    star: earthStar,
    sun: earthSun,
    cosmos: earthCosmos,
  },
  air: {
    spark: airSpark,
    glow: airGlow,
    flame: airFlame,
    star: airStar,
    sun: airSun,
    cosmos: airCosmos,
  },
  light: {
    spark: lightSpark,
    glow: lightGlow,
    flame: lightFlame,
    star: lightStar,
    sun: lightSun,
    cosmos: lightCosmos,
  },
};

export const PET_IMAGES_BASE: Record<PetElement, string> = {
  fire: PET_IMAGES.fire.flame,
  water: PET_IMAGES.water.flame,
  earth: PET_IMAGES.earth.flame,
  air: PET_IMAGES.air.flame,
  light: PET_IMAGES.light.flame,
};
