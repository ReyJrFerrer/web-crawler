import Queue from "bull";
const queue = new Queue('test2', 'redis://localhost:6379');
async function run() {
  await queue.add('named', { my: 'data' });
  queue.process(async (job) => {
    console.log("Processed:", job.name, job.data);
    process.exit(0);
  });
}
run();
