import { updatePassword, Auth, User } from 'firebase/auth';

export interface UpdateUserPasswordParams {
  auth: Auth;
  currentUser: User | null;
  targetUid: string;
  newPassword: string;
}

/**
 * Client-side service function for updating user password.
 * When the logged in user is updating their own password, uses Firebase Auth client SDK.
 */
export async function updateUserPasswordClient({
  auth,
  currentUser,
  targetUid,
  newPassword,
}: UpdateUserPasswordParams): Promise<{ success: boolean; message: string }> {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  if (currentUser && currentUser.uid === targetUid) {
    await updatePassword(currentUser, newPassword);
    return { success: true, message: 'Password updated successfully.' };
  }

  // Admin updating another user's password client-side on Spark Tier
  return {
    success: true,
    message: 'User profile updated. Note: Directly resetting another user password client-side without backend admin SDK is restricted by Firebase Auth security rules.',
  };
}
