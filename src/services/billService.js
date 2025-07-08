export const addPendingBill = async (billData) => {
  return await window.electronAPI.addPendingBill(billData);
};

export const getPendingBills = async () => {
  return await window.electronAPI.getPendingBills();
};

export const updatePendingBill = async (id, billData) => {
  return await window.electronAPI.updatePendingBill(id, billData);
};

export const deletePendingBill = async (id) => {
  return await window.electronAPI.deletePendingBill(id);
};

export const clearPendingBill = async (id) => {
  return await window.electronAPI.clearPendingBill(id);
};
