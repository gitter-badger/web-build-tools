// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import * as fsx from 'fs-extra';
import * as path from 'path';

/**
 * A helper utility for working with file-based locks.
 * This class should only be used for locking resources across processes,
 * but should not be used for attempting to lock a resource in the same process.
 * @public
 */
export class LockFile {
  /**
   * Attempts to create a lockfile with the given filePath.
   * If successful, returns a LockFile instance.
   * If unable to get a lock, returns undefined.
   * @param filePath - the filePath of the lockfile.
   */
  public static tryAcquire(filePath: string): LockFile | undefined {
    let dirtyWhenAcquired: boolean = false;

    if (fsx.existsSync(filePath)) {
      // If the lockfile is held by an process with an exclusive lock, then removing it will
      // silently fail. OpenSync() below will then fail and we will be unable to create a lock.

      // Otherwise, the lockfile is sitting on disk, but nothing is holding it, implying that
      // the last process to hold it died.
      dirtyWhenAcquired = true;
      fsx.removeSync(filePath);
    }

    let fileDescriptor: number;
    try {
      // Attempt to open an exclusive lockfile
      fileDescriptor = fsx.openSync(filePath, 'wx');
    } catch (error) {
      // we tried to delete the lock, but something else is holding it,
      // (probably an active process), therefore we are unable to create a lock
      return undefined;
    }

    return new LockFile(fileDescriptor, filePath, dirtyWhenAcquired);
  }

  /**
   * Unlocks a file and removes it from disk.
   * This can only be called once.
   */
  public release(): void {
    if (this.isReleased) {
      throw new Error(`The lock for file "${path.basename(this._filePath)}" has already been released.`);
    }

    fsx.closeSync(this._fileDescriptor!);
    fsx.removeSync(this._filePath);
    this._fileDescriptor = undefined;
  }

  /**
   * Returns the initial state of the lock.
   * This can be used to detect if the previous process was terminated before releasing the resource.
   */
  public get dirtyWhenAcquired(): boolean {
    return this._dirtyWhenAcquired;
  }

  /**
   * Returns true if this lock is currently being held.
   */
  public get isReleased(): boolean {
    return this._fileDescriptor === undefined;
  }

  private constructor(
    private _fileDescriptor: number | undefined,
    private _filePath: string,
    private _dirtyWhenAcquired: boolean) {
  }
}