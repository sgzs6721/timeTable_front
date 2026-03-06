import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import SalaryMaster from './SalaryMaster';
import { getOrganization } from '../services/organization';
import OrganizationManagementPageLayout from '../components/OrganizationManagementPageLayout';

const OrganizationSalaryManagement = () => {
  const { organizationId } = useParams();
  const [organization, setOrganization] = useState(null);

  useEffect(() => {
    const loadOrganization = async () => {
      const response = await getOrganization(organizationId);
      if (response.success) {
        setOrganization(response.data);
      }
    };

    loadOrganization();
  }, [organizationId]);

  return (
    <OrganizationManagementPageLayout
      title="工资管理"
      organization={organization}
      contentClassName="organization-salary-management"
    >
        <SalaryMaster organizationId={organizationId} />
    </OrganizationManagementPageLayout>
  );
};

export default OrganizationSalaryManagement;

