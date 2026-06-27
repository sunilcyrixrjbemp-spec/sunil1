/**
 * useBiometricLogin Hook
 * 
 * Adds fingerprint / face ID login to the app.
 * After first successful password login, subsequent logins can use biometric.
 * 
 * Usage:
 *   const { biometricAvailable, biometryType, loginWithBiometric } = useBiometricLogin();
 */

import { useState, useEffect, useCallback } from 'react';
import { biometricAuth, isNativeApp } from '../utils/capacitor';
import { nativeConfig } from '../utils/persistence';
import toast from 'react-hot-toast';

const BIOMETRIC_ENABLED_KEY = 'biometric_login_enabled';
const SAVED_CREDENTIALS_KEY = 'biometric_saved_credentials';

export interface UseBiometricLoginReturn {
  biometricAvailable: boolean;
  biometryType: 'fingerprint' | 'face' | 'none';
  biometricEnabled: boolean;
  loginWithBiometric: () => Promise<boolean>;
  enableBiometricLogin: (username: string, password: string) => Promise<void>;
  disableBiometricLogin: () => void;
}

export const useBiometricLogin = (): UseBiometricLoginReturn => {
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometryType, setBiometryType] = useState<'fingerprint' | 'face' | 'none'>('none');
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    const checkBiometric = async () => {
      if (!isNativeApp()) return;
      const available = await biometricAuth.isAvailable();
      setBiometricAvailable(available);
      if (available) {
        const type = await biometricAuth.getBiometryType();
        setBiometryType(type);
      }
      const enabled = (await nativeConfig.get(BIOMETRIC_ENABLED_KEY)) === 'true';
      setBiometricEnabled(enabled && available);
    };
    checkBiometric();
  }, []);

  /**
   * Perform biometric login using saved credentials
   */
  const loginWithBiometric = useCallback(async (): Promise<boolean> => {
    if (!biometricAvailable) return false;

    const reason = biometryType === 'face'
      ? 'Use Face ID to login'
      : 'Use fingerprint to login';

    const authResult = await biometricAuth.authenticate(reason);
    if (!authResult.success) {
      toast.error(authResult.error || 'Biometric authentication failed');
      return false;
    }

    // Get saved credentials
    const savedCreds = await nativeConfig.get(SAVED_CREDENTIALS_KEY);
    if (!savedCreds) {
      toast.error('No saved credentials found. Please login with password first.');
      return false;
    }

    try {
      const { username, password } = JSON.parse(savedCreds);
      // Import authService dynamically
      const { authService } = await import('../services/authService');
      try {
        await authService.login({ user_id: username, password });
        toast.success(`Welcome back! 👋`, { icon: biometryType === 'face' ? '😊' : '👆' });
        return true;
      } catch (_) {
        toast.error('Session expired. Please login with password.');
        disableBiometricLogin();
        return false;
      }
    } catch (e) {
      toast.error('Biometric login failed. Please try with password.');
      return false;
    }
  }, [biometricAvailable, biometryType]);

  /**
   * Enable biometric login — saves encrypted credentials after first password login
   */
  const enableBiometricLogin = useCallback(async (username: string, password: string): Promise<void> => {
    if (!biometricAvailable) return;

    const authResult = await biometricAuth.authenticate('Confirm to enable biometric login');
    if (!authResult.success) {
      toast.error('Biometric confirmation failed');
      return;
    }

    await nativeConfig.set(SAVED_CREDENTIALS_KEY, JSON.stringify({ username, password }));
    await nativeConfig.set(BIOMETRIC_ENABLED_KEY, 'true');
    setBiometricEnabled(true);

    const typeLabel = biometryType === 'face' ? 'Face ID' : 'Fingerprint';
    toast.success(`${typeLabel} login enabled! 🔐`);
  }, [biometricAvailable, biometryType]);

  /**
   * Disable biometric login and clear saved credentials
   */
  const disableBiometricLogin = useCallback(async (): Promise<void> => {
    await nativeConfig.remove(SAVED_CREDENTIALS_KEY);
    await nativeConfig.remove(BIOMETRIC_ENABLED_KEY);
    setBiometricEnabled(false);
    toast.success('Biometric login disabled');
  }, []);

  return {
    biometricAvailable,
    biometryType,
    biometricEnabled,
    loginWithBiometric,
    enableBiometricLogin,
    disableBiometricLogin,
  };
};
