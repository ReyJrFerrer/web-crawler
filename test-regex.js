const paths = [
  "/calendar/2026/01/01/calendar/2026/01/01",
  "/normal/page",
  "/a/b/c/a/b/c",
  "/users/users/users"
];

const hasRepetition = (pathname) => {
  // Regex to find a sequence of one or more path segments that repeat consecutively
  // \/(.*?)\/  -> this is hard, let's just split and check
  const regex = /(\/[^\/]+.+?)\1+/i;
  // A safer regex for whole segments: 
  const segmentRegex = /(?:\/[^\/]+){1,}/g; 
  // Let's use a simpler approach:
  const match = pathname.match(/((\/[^\/]+)+)\1+/i);
  return match !== null;
};

paths.forEach(p => console.log(p, hasRepetition(p)));
