export interface NcertBook {
    class: string;
    subject: string;
    title: string;
    url: string;
}

export const NCERT_BOOKS: NcertBook[] = [
    // Class 12
    { class: '12', subject: 'Physics', title: 'Physics Part I', url: 'https://ncert.nic.in/textbook.php?leph1=0-8' },
    { class: '12', subject: 'Physics', title: 'Physics Part II', url: 'https://ncert.nic.in/textbook.php?leph2=0-6' },
    { class: '12', subject: 'Chemistry', title: 'Chemistry Part I', url: 'https://ncert.nic.in/textbook.php?lech1=0-5' },
    { class: '12', subject: 'Chemistry', title: 'Chemistry Part II', url: 'https://ncert.nic.in/textbook.php?lech2=0-4' },
    { class: '12', subject: 'Maths', title: 'Mathematics Part I', url: 'https://ncert.nic.in/textbook.php?lemh1=0-6' },
    { class: '12', subject: 'Maths', title: 'Mathematics Part II', url: 'https://ncert.nic.in/textbook.php?lemh2=0-7' },
    { class: '12', subject: 'Biology', title: 'Biology', url: 'https://ncert.nic.in/textbook.php?lebo1=0-13' },
    { class: '12', subject: 'English', title: 'Flamingo', url: 'https://ncert.nic.in/textbook.php?lefl1=0-8' },

    // Class 11
    { class: '11', subject: 'Physics', title: 'Physics Part I', url: 'https://ncert.nic.in/textbook.php?keph1=0-8' },
    { class: '11', subject: 'Physics', title: 'Physics Part II', url: 'https://ncert.nic.in/textbook.php?keph2=0-7' },
    { class: '11', subject: 'Chemistry', title: 'Chemistry Part I', url: 'https://ncert.nic.in/textbook.php?kech1=0-6' },
    { class: '11', subject: 'Chemistry', title: 'Chemistry Part II', url: 'https://ncert.nic.in/textbook.php?kech2=0-3' },
    { class: '11', subject: 'Biology', title: 'Biology', url: 'https://ncert.nic.in/textbook.php?kebo1=0-19' },
    { class: '11', subject: 'Maths', title: 'Mathematics', url: 'https://ncert.nic.in/textbook.php?kemh1=0-14' },

    // Class 10
    { class: '10', subject: 'Science', title: 'Science', url: 'https://ncert.nic.in/textbook.php?jesc1=0-13' },
    { class: '10', subject: 'Maths', title: 'Mathematics', url: 'https://ncert.nic.in/textbook.php?jemh1=0-14' },
    { class: '10', subject: 'Social Science', title: 'Contemporary India', url: 'https://ncert.nic.in/textbook.php?jess1=0-7' },
    { class: '10', subject: 'English', title: 'First Flight', url: 'https://ncert.nic.in/textbook.php?jeff1=0-9' },

    // Class 9
    { class: '9', subject: 'Science', title: 'Science', url: 'https://ncert.nic.in/textbook.php?iesc1=0-12' },
    { class: '9', subject: 'Maths', title: 'Mathematics', url: 'https://ncert.nic.in/textbook.php?iemh1=0-12' },
    { class: '9', subject: 'Social Science', title: 'Democratic Politics', url: 'https://ncert.nic.in/textbook.php?ieps1=0-5' },
    { class: '9', subject: 'English', title: 'Beehive', url: 'https://ncert.nic.in/textbook.php?iebe1=0-9' },
];
