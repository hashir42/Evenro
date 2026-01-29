import { useEffect } from 'react';

export const useScrollToTopOnChange = (dependencies: any[]) => {
  useEffect(() => {
    // Only scroll if we're not at the top already to prevent unnecessary jumps
    if (window.scrollY > 0) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, dependencies);
};

export default useScrollToTopOnChange;
