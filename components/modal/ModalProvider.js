"use client";

import { createContext, useContext, useState } from "react";

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [modal, setModal] = useState({
    open: false,
    title: "",
    content: null
  });

  const openModal = ({ title = "", content }) => {
    setModal({ open: true, title, content });
  };

  const closeModal = () => {
    setModal({ open: false, title: "", content: null });
  };

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
}

export const useModal = () => useContext(ModalContext);
