/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include <unistd.h>
#include <sys/resource.h>
#include <stdio.h>


void closeOtherFds(int fdIn, int fdOut, int fdErr, const int dupFds[], int skipFd) {

  int maxFD = 256; /* arbitrary max */
  int i, j;
  struct rlimit rl;

  if (getrlimit(RLIMIT_NOFILE, &rl) == 0) {
      if (rl.rlim_cur <  999999) /* ignore too high numbers */
        maxFD = rl.rlim_cur;
  }

  /* close any file descriptors */
  /* fd's 0-2 + skipFds are already closed */
  for (i = 3 + skipFd; i < maxFD; i++) {
    int closeFd = 1;
    if (i != fdIn && i != fdOut && i != fdErr) {
      for (j = 0; j < skipFd; j++) {
        if (i == dupFds[j]) closeFd = 0;
      }
      if (closeFd) close(i);
    }
  }
}


/**
  * Launch a new process by forking it and close unused file descriptors.
  * All file descriptors after stderr are closed.
  *
  * @path: full path to the executable file
  * @argv: array of arguments as defined by execve
  * @envp: array of environment variables as defined by execve
  * @fd_in: array of 2 integers containing the stdin file descriptors
  * @fd_out: array of 2 integers containing the stdout file descriptors
  * @fd_err: array of 2 integers containing the stderr file descriptors
  * @skipFd: number of file descriptors to skip when closing FDs.
  */

pid_t launchProcess(const char *path,
                    char *const argv[],
                    char *const envp[],
                    const char* workdir,
                    const int fd_in[2],
                    const int fd_out[2],
                    const int fd_err[2],
                    const int dupFds[])
{
  pid_t pid;

  int mergeStderr = (fd_err ? 0 : 1);

  pid = fork();
  if (pid == 0) {
    int countFd = 0;
    int i;
    /* child */
    if (workdir) {
      if (chdir(workdir) < 0) {
        _exit(126);
      }
    }

    while (dupFds[countFd] > 0) {
      ++countFd;
    }

    closeOtherFds(fd_in[0], fd_out[1], fd_err ? fd_err[1] : 0, dupFds, countFd);

    close(fd_in[1]);
    close(fd_out[0]);
    if (!mergeStderr)
      close(fd_err[0]);
    close(0);
    dup2(fd_in[0], 0);
    close(1);
    dup2(fd_out[1], 1);
    close(2);

    dup2(mergeStderr ? fd_out[1] : fd_err[1], 2);

    for (i=0; i<countFd; i++) {
      dup2(dupFds[i], 3 + i);
    }

    execve(path, argv, envp);
    _exit(1);
  }

  /* parent */
  return pid;
}
