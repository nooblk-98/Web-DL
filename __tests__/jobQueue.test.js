'use strict';

const JobQueue = require('../lib/jobQueue');

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('JobQueue', () => {
  it('runs up to the cap, queues overflow, rejects duplicate tokens', async () => {
    const q = new JobQueue(1);

    let releaseA;
    const aRunning = new Promise((resolve) => {
      releaseA = resolve;
    });
    let bStarted = false;

    expect(q.submit('a', () => aRunning).state).toBe('started');
    expect(
      q.submit('b', () => {
        bStarted = true;
        return Promise.resolve();
      }).state
    ).toBe('queued');

    // Duplicate token while busy.
    expect(q.submit('a', () => Promise.resolve()).state).toBe('busy');
    expect(bStarted).toBe(false);

    // Finishing 'a' should drain and start 'b'.
    releaseA();
    await flush();
    expect(bStarted).toBe(true);
  });

  it('removes a still-queued job', () => {
    const q = new JobQueue(1);
    q.submit('a', () => new Promise(() => {})); // never resolves
    expect(q.submit('b', () => Promise.resolve()).state).toBe('queued');
    expect(q.has('b')).toBe(true);
    expect(q.remove('b')).toBe(true);
    expect(q.has('b')).toBe(false);
    expect(q.remove('b')).toBe(false);
  });

  it('frees the slot even when a job rejects', async () => {
    const q = new JobQueue(1);
    let started = false;
    q.submit('a', () => Promise.reject(new Error('boom')));
    await flush();
    q.submit('b', () => {
      started = true;
      return Promise.resolve();
    });
    await flush();
    expect(started).toBe(true);
  });
});
