/**
 * Example usage of serviceStorage utilities
 * 
 * This file demonstrates how to use the service storage utilities
 * in other components that need access to the current service data.
 */

import { 
  getServiceData, 
  getServiceId, 
  getServiceCode,
  saveServiceData,
  updateServiceData,
  clearServiceData 
} from './serviceStorage';

// Example 1: Get the current serviceId in any component
export const exampleGetServiceId = () => {
  const serviceId = getServiceId();
  
  if (serviceId) {
    console.log('Current service ID:', serviceId);
    // Use serviceId to make API calls
    // Example: await createServiceFee({ serviceId, fee: 100 });
  } else {
    console.log('No service data found. Please save service information first.');
  }
};

// Example 2: Get the full service data
export const exampleGetFullData = () => {
  const serviceData = getServiceData();
  
  if (serviceData) {
    console.log('Service ID:', serviceData.serviceId);
    console.log('Service Code:', serviceData.serviceCode);
    console.log('Service Name (EN):', serviceData.nameEn);
    console.log('Service Name (AR):', serviceData.nameAr);
    console.log('Department:', serviceData.department);
  }
};

// Example 3: Update specific fields
export const exampleUpdateStatus = () => {
  updateServiceData({
    status: 'published'
  });
};

// Example 4: Clear service data when leaving the page
export const exampleClearOnExit = () => {
  // Call this when user navigates away or completes the workflow
  clearServiceData();
};

// Example 5: Use in Fee Configuration component
export const FeeConfigurationExample = async () => {
  const serviceId = getServiceId();
  
  if (!serviceId) {
    alert('Please save service information first');
    return;
  }
  
  // Now you can use serviceId to create fee
  const feeData = {
    serviceId: serviceId,
    fee: 150.00
  };
  
  // await createServiceFee(feeData);
  console.log('Fee data ready:', feeData);
};

// Example 6: Use in Certificate Configuration component
export const CertificateConfigurationExample = async () => {
  const serviceData = getServiceData();
  
  if (!serviceData) {
    alert('Please save service information first');
    return;
  }
  
  const certificateData = {
    serviceId: serviceData.serviceId,
    templateId: 1,
    validityPeriod: '1year'
  };
  
  console.log('Certificate data ready:', certificateData);
};
