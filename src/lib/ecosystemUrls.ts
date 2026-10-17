export const ECOSYSTEM_URLS = {
  funRich: "https://fun.rich",
  loveHub: "https://lovehub.fun.rich",
  academy: "https://academy.fun.rich",
  farm: "https://farm.fun.rich",
  charity: "https://charity.fun.rich",
} as const;

export const ECOSYSTEM_PLATFORMS = [
  { key: "funRich", name: "Fun.Rich", url: ECOSYSTEM_URLS.funRich, desc: "FUN Profile · Community · Social", status: "live" as const },
  { key: "loveHub", name: "LoveHUB", url: ECOSYSTEM_URLS.loveHub, desc: "Tình yêu & kết nối", status: "coming" as const },
  { key: "academy", name: "FUN Academy", url: ECOSYSTEM_URLS.academy, desc: "Học tập & tri thức", status: "coming" as const },
  { key: "farm", name: "FUN Farm", url: ECOSYSTEM_URLS.farm, desc: "Trang trại số", status: "coming" as const },
  { key: "charity", name: "FUN Charity", url: ECOSYSTEM_URLS.charity, desc: "Thiện nguyện minh bạch", status: "coming" as const },
];
