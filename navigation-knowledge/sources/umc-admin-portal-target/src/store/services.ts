import create from "zustand";
import { persist } from "zustand/middleware";

export interface IUser {
  servicesId: number | null;
  servicesType: string;
  servicesName: string;
  applicationId: number;
  formilyData: any[]; // Add this line
  Department: number | null;
  servicesCode: number | null;
}

const initialUserValues = {
  servicesId: null,
  servicesCode: null,
  servicesType: "",
  servicesName: "",
  applicationId: 0,
  formilyData: [], // Add this line
  Department: 0

};

export const useServicesStore = create(
  persist(
    (set) => ({
      userInfo: initialUserValues,
      setData: (data: IUser) => set({ userInfo: data }),
      resetUserInfo: () => set(initialUserValues),
      updateServicesId: (id: number | null) =>
        set((state: { userInfo: IUser }) => ({
          userInfo: {
            ...state.userInfo,
            servicesId: id,
          },
        })),
      updateServicesCode: (id: number | null) =>
        set((state: { userInfo: IUser }) => ({
          userInfo: {
            ...state.userInfo,
            servicesCode: id,
          },
        })),
      updateServicesDepartment: (Department: number | null) =>
        set((state: { userInfo: IUser }) => ({
          userInfo: {
            ...state.userInfo,
            Department: Department,
          },
        })),
      updateServicesType: (type: string) =>
        set((state: { userInfo: IUser }) => ({
          userInfo: {
            ...state.userInfo,
            servicesType: type,
          },
        })),

      updateServicesName: (type: string) =>
        set((state: { userInfo: IUser }) => ({
          userInfo: {
            ...state.userInfo,
            servicesName: type,
          },
        })),

      updateApplicationId: (type: number) =>
        set((state: { userInfo: IUser }) => ({
          userInfo: {
            ...state.userInfo,
            applicationId: type,
          },
        })),
      updateFormilyData: (data: any[]) =>
        set((state: { userInfo: IUser }) => ({
          userInfo: {
            ...state.userInfo,
            formilyData: data,
          },
        })),
    }),
    {
      name: "services-storage", // name of the item in the storage (must be unique)
      getStorage: () => localStorage, // (optional) by default, 'localStorage' is used
    }
  )
);
