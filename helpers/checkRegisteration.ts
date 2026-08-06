import { AuthProviders } from "../data/common";

interface AuthProvider {
  provider: string;
}

interface Registration {
  authProviders: AuthProvider[];
}
export const checkRegistration0 = (
  authProviders: AuthProvider[],
  authType: AuthProviders
): { status: number; data: string } => {
  const authProvidersEnum = Object.values(AuthProviders);

  /* for (const provider of authProvidersEnum) {
     if (provider !== authType) {
       console.log(`Checking provider: ${provider}`);
       for (const authProvider of authProviders) {
         console.log(`authProvider.provider: ${authProvider.provider}`);
         if (authProvider.provider === provider) {
           let message = `Email already registered with ${provider}.`;
           if (provider === AuthProviders.Local) {
             message = "Email already registered with direct email process";
           }
           return { status: 500, data: message };
         }
       }
     }
   }
   // If no match found, return success
   return { status: 200, data: "Registration allowed" }; */
  for (const authProvider of authProviders) {
    if (authProvider.provider === authType) {
      let message = `Email already registered with ${authType}.`;
      if (authType === AuthProviders.Local) {
        message = "Email already registered with direct email process";
      }
      return { status: 500, data: message };
    }
  }

  // If no match found, return success
  return { status: 200, data: "Registration allowed" };
};

export const checkRegistration = (
  authProviders: AuthProvider[],
  authType: AuthProviders
): { status: number; data: string } => {
  for (const authProvider of authProviders) {
    if (authProvider.provider === AuthProviders.Local) {
      return {
        status: 500,
        data: "Email already registered with direct email process",
      };
    }

    if (authProvider.provider === authType) {
      return {
        status: 500,
        data: `Email already registered with ${authType}.`,
      };
    }
  }

  return { status: 200, data: "Registration allowed" };
};


export const validateLoginProvider = (
  authProviders: AuthProvider[],
  authType: AuthProviders
): { status: number; data: string } => {
  const provider = authProviders.find(
    (provider) => provider.provider === authType
  );

  if (provider) {
    return { status: 200, data: "Login allowed" };
  }

  // If the required provider is not found, return a message indicating which provider should be used
  if (authProviders.length > 0) {
    // Specific message for Local provider
    if (
      authProviders.some(
        (provider) => provider.provider === AuthProviders.Local
      )
    ) {
      return { status: 400, data: "Please log in using direct email process" };
    }

    const registeredProviders = authProviders
      .map((provider) => provider.provider)
      .join(", ");
    return {
      status: 400,
      data: `Please log in using one of the following providers: ${registeredProviders}`,
    };
  }

  return {
    status: 400,
    data: `No registered providers found. Please sign up first.`,
  };
};
