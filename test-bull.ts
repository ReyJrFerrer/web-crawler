import Queue from "bull";
const queue = new Queue('test', 'redis://localhost:6379');
async function run() {
  const job = await queue.add('my-name', { my: 'data' });
  console.log(job.name, job.data);
  process.exit(0);
}
run();
