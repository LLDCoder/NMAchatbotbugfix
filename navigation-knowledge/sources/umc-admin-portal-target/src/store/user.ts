import create from 'zustand'
import { persist } from 'zustand/middleware'
import { AUTH_USER_STORAGE_KEY } from '@/storage/authStorage'
import { migrateLegacyAuthStorage } from '@/storage/migrateLegacyAuthStorage'

migrateLegacyAuthStorage()

interface IListRole{
    descAr: string | null;
    descEn: string | null;
    discriminator: string;
    id: string;
    isShown: boolean;
    name: string;
    nameAr: string;
    nameEn: string;
    users: unknown[];
}

interface IRoleInfo{
    roleID?: string;
    roleName?: string;
}

interface IdentityData {
    id: number;
    name: string;
    photoUrl: string;
    userProfileId: string;
    userTypeId: string;
    email: string;
}
interface IuserEstablishments{
  establishmentUrl: string | null;
  id: number;
  nameAr: string;
  nameEn: string;
  userProfileId: string;
  userTypeId: string
}
export interface IUser{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    listRoles: IListRole[];
    rolesInfo?: IRoleInfo[];
    listUserFilter: null;
    listUserProfile: null;
    phoneNumber: null;
    token: string;
    userInvitation: IdentityData;
    userProfileInfo: any[];
    userEstablishments: IuserEstablishments[];
    isFirstLogin: boolean;
    createOn: string;
    listSysPermission:any[]
}

const initialUserValues: IUser = {
    id: '',
    userProfileInfo: [],
    email: '',
    firstName: '',
    lastName: '',
    listRoles: [],
    userEstablishments: [],
    userInvitation: {} as IdentityData,
    isFirstLogin: false,
    listUserFilter: null,
    listUserProfile: null,
    phoneNumber: null,
    token: '',
    createOn: '',
    listSysPermission:[]
}

export const useUserStore = create(
  persist(
    (set) => ({
      userInfo: initialUserValues,
      currentProfileId: '',
      setData: (data: IUser) => set({ userInfo: data }),
      setCurrentProfileId: (id: string) => set({ currentProfileId: id }),
      resetUserInfo: () =>
        set({ userInfo: initialUserValues, currentProfileId: '' }),
    }),
    {
      name: AUTH_USER_STORAGE_KEY, // name of the item in the storage (must be unique)
      getStorage: () => localStorage, // (optional) by default, 'localStorage' is used
    },
  ),
)
